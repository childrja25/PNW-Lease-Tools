const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

// ===== GOOGLE CREDENTIALS SETUP =====
// Railway users can paste their service account JSON as an env var.
// We write it to a temp file so that the Google client libraries can find it.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const credPath = path.join(os.tmpdir(), 'gcp-credentials.json');
    fs.writeFileSync(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    console.log(`Wrote GCP credentials to ${credPath}`);
  } catch (err) {
    console.error('Failed to write GOOGLE_APPLICATION_CREDENTIALS_JSON to temp file:', err.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// ===== BASIC AUTH MIDDLEWARE =====
const AUTH_USER = process.env.AUTH_USERNAME;
const AUTH_PASS = process.env.AUTH_PASSWORD;

if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    // Skip auth for health check (Railway needs this for deployment)
    if (req.path === '/api/health') return next();

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Lease Abstraction Tool"');
      return res.status(401).send('Authentication required');
    }
    const credentials = Buffer.from(header.split(' ')[1], 'base64').toString();
    const [user, pass] = credentials.split(':');
    if (user === AUTH_USER && pass === AUTH_PASS) {
      return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Lease Abstraction Tool"');
    return res.status(401).send('Invalid credentials');
  });
  console.log('Basic auth enabled');
} else {
  console.log('WARNING: No AUTH_USERNAME/AUTH_PASSWORD set — app is publicly accessible');
}

app.use(express.static(path.join(__dirname, '../public')));

// ===== REQUEST LOGGING MIDDLEWARE =====
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Config
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'leases';
const EMBEDDING_MODEL = 'gemini-embedding-2-preview';
const DIMENSIONS = 768;
const USE_VERTEX = process.env.USE_VERTEX === 'true';

// File upload setup
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// Ensure directories exist
['./uploads', './data'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ===== EMBEDDING FUNCTIONS =====

async function embedWithGemini(content, mimeType = null) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

  const model = EMBEDDING_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  const parts = [{ text: typeof content === 'string' ? content : String(content) }];

  const body = JSON.stringify({
    model: `models/${model}`,
    content: { parts },
    outputDimensionality: DIMENSIONS
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini API error ${res.statusCode}: ${data}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(json.embedding?.values || []);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function embedWithVertex(content, mimeType = null) {
  // Vertex AI embedding - requires @google-cloud/aiplatform
  // This keeps data within your GCP project with full compliance
  const { PredictionServiceClient } = require('@google-cloud/aiplatform');

  const project = process.env.VERTEX_PROJECT;
  const location = process.env.VERTEX_LOCATION || 'us-central1';

  const client = new PredictionServiceClient({
    apiEndpoint: `${location}-aiplatform.googleapis.com`
  });

  const endpoint = `projects/${project}/locations/${location}/publishers/google/models/multimodalembedding@001`;

  let instance;
  if (mimeType === 'application/pdf') {
    instance = { document: { bytesBase64Encoded: content, mimeType } };
  } else if (mimeType?.startsWith('image/')) {
    instance = { image: { bytesBase64Encoded: content } };
  } else {
    instance = { text: content };
  }

  const [response] = await client.predict({
    endpoint,
    instances: [{ structValue: { fields: instance } }]
  });

  return response.predictions[0].structValue.fields.embedding.listValue.values.map(v => v.numberValue);
}

async function embed(content, mimeType = null) {
  if (USE_VERTEX) {
    return embedWithVertex(content, mimeType);
  }
  return embedWithGemini(content, mimeType);
}

// ===== QDRANT FUNCTIONS =====

function qdrantRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, QDRANT_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = client.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function ensureCollection() {
  const collections = await qdrantRequest('GET', '/collections');
  const exists = collections.result?.collections?.some(c => c.name === COLLECTION);

  if (exists) {
    // Check if existing collection has the correct dimensions
    const info = await qdrantRequest('GET', `/collections/${COLLECTION}`);
    const currentSize = info.result?.config?.params?.vectors?.size;
    if (currentSize && currentSize !== DIMENSIONS) {
      console.log(`Collection dimension mismatch (has ${currentSize}, need ${DIMENSIONS}). Recreating collection...`);
      await qdrantRequest('DELETE', `/collections/${COLLECTION}`);
      await qdrantRequest('PUT', `/collections/${COLLECTION}`, {
        vectors: { size: DIMENSIONS, distance: 'Cosine' }
      });
      console.log(`Recreated collection: ${COLLECTION} with ${DIMENSIONS} dimensions (${EMBEDDING_MODEL})`);
    }
  } else {
    await qdrantRequest('PUT', `/collections/${COLLECTION}`, {
      vectors: { size: DIMENSIONS, distance: 'Cosine' }
    });
    console.log(`Created collection: ${COLLECTION} with ${DIMENSIONS} dimensions (${EMBEDDING_MODEL})`);
  }
}

// Retry wrapper for ensureCollection - Qdrant may not be ready at startup on Railway
async function ensureCollectionWithRetry(maxAttempts = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureCollection();
      return;
    } catch (err) {
      console.warn(`Qdrant connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) {
        throw new Error(`Failed to connect to Qdrant after ${maxAttempts} attempts: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Helper: safely delete a file (used for cleanup on upload errors)
function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to clean up file ${filePath}:`, err.message);
  }
}

// ===== LEASE EXTRACTION =====

async function extractLeaseFields(pdfPath) {
  // Use Gemini to extract structured lease data
  const apiKey = process.env.GOOGLE_API_KEY;
  const pdfData = fs.readFileSync(pdfPath);
  const base64 = pdfData.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Extract the following fields from this commercial lease document. Return JSON only, no markdown:
{
  "tenant_name": "",
  "property_address": "",
  "building_name": "",
  "suite_number": "",
  "rentable_square_footage": "",
  "lease_commencement_date": "",
  "rent_commencement_date": "",
  "lease_term": "",
  "base_rent_schedule": [{"period": "", "annual_rent": "", "monthly_rent": "", "rent_psf": ""}],
  "tenant_improvement_allowance": "",
  "termination_options": "",
  "parking_rights": "",
  "renewal_options": "",
  "right_of_first_offer": "",
  "right_of_first_refusal": "",
  "right_of_purchase_offer": "",
  "expense_recovery_type": "gross/modified gross/NNN/other",
  "base_year": "",
  "management_fee_cap": "",
  "lease_guarantor": "",
  "letter_of_credit": "",
  "signing_entity": "",
  "expense_gross_up_pct": "",
  "pro_rata_share": "",
  "building_denominator": "",
  "permitted_uses": "",
  "exclusive_uses": "",
  "expense_exclusions": ""
}

For base_rent_schedule, include ALL rows from any rent schedule table in the lease (each period/step with its annual rent, monthly rent, and rent per square foot). If a field is not found, use null.`;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'application/pdf', data: base64 } }
      ]
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`Gemini extraction API error ${res.statusCode}: ${data.substring(0, 500)}`);
            reject(new Error(`Gemini extraction failed (${res.statusCode}). Check API quota/billing.`));
            return;
          }
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          // Clean up markdown if present
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          console.error('Extraction error:', e.message);
          resolve({});
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  const health = { status: 'ok', vertex: USE_VERTEX };

  if (!USE_VERTEX && !process.env.GOOGLE_API_KEY) {
    health.status = 'misconfigured';
    health.error = 'GOOGLE_API_KEY environment variable is not set. Set it to your Gemini API key, or set USE_VERTEX=true with proper GCP credentials for Vertex AI.';
  }

  res.json(health);
});

// Upload and process lease
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const uploadedFilePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await ensureCollection();

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    console.log(`Processing: ${fileName}`);

    // Extract lease fields first
    const fields = await extractLeaseFields(filePath);

    // Build text summary for embedding (text-only — the embedding model doesn't accept PDFs)
    const textForEmbedding = Object.entries(fields)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
    const vector = await embed(textForEmbedding || `lease ${fileName}`);

    // Generate ID
    const id = Date.now();

    // Store in Qdrant
    await qdrantRequest('PUT', `/collections/${COLLECTION}/points`, {
      points: [{
        id,
        vector,
        payload: {
          filename: fileName,
          filepath: filePath,
          uploaded_at: new Date().toISOString(),
          ...fields
        }
      }]
    });

    res.json({
      success: true,
      id,
      filename: fileName,
      fields
    });

  } catch (error) {
    console.error('Upload error:', error);
    cleanupFile(uploadedFilePath);
    res.status(500).json({ error: error.message });
  }
});

// Search leases
app.post('/api/search', async (req, res) => {
  try {
    const { query, type = 'text', limit = 10 } = req.body;

    let vector;
    if (type === 'text') {
      vector = await embed(query);
    } else {
      // Image/PDF search would go here
      return res.status(400).json({ error: 'Only text search supported in this endpoint' });
    }

    const results = await qdrantRequest('POST', `/collections/${COLLECTION}/points/search`, {
      vector,
      limit,
      with_payload: true
    });

    res.json({
      results: results.result?.map(r => ({
        score: r.score,
        ...r.payload
      })) || []
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all leases
app.get('/api/leases', async (req, res) => {
  try {
    const result = await qdrantRequest('POST', `/collections/${COLLECTION}/points/scroll`, {
      limit: 100,
      with_payload: true
    });

    res.json({
      leases: result.result?.points?.map(p => ({
        id: p.id,
        ...p.payload
      })) || []
    });

  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a lease
app.delete('/api/leases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid lease ID' });
    }

    const result = await qdrantRequest('POST', `/collections/${COLLECTION}/points/delete`, {
      points: [id]
    });

    if (result.status === 'ok' || result.result === true) {
      res.json({ success: true, id });
    } else {
      res.status(500).json({ error: 'Failed to delete lease', details: result });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collection stats
app.get('/api/stats', async (req, res) => {
  try {
    const info = await qdrantRequest('GET', `/collections/${COLLECTION}`);
    res.json({
      count: info.result?.points_count || 0,
      status: info.result?.status || 'unknown'
    });
  } catch (error) {
    res.json({ count: 0, status: 'not initialized' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lease Abstraction Tool running on http://localhost:${PORT}`);
  console.log(`Using: ${USE_VERTEX ? 'Vertex AI (enterprise)' : 'Gemini API'}`);
  ensureCollectionWithRetry().catch(err => {
    console.error('Qdrant initialization failed:', err.message);
    console.error('The server will continue running - Qdrant operations will be attempted on each request.');
  });
});
