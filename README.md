# 📄 Lease Abstraction Tool

Multimodal search and extraction for commercial real estate leases, powered by **Gemini Embedding 2**.

Upload lease PDFs → automatically extract key terms → search across your entire portfolio with natural language.

![Demo](docs/demo.gif)

## ✨ Features

- **No OCR needed** - The model "sees" PDFs directly, including tables and formatting
- **Auto-extraction** - Pulls tenant, rent, term, CAM, renewal options, etc.
- **Semantic search** - Find "leases expiring next year with renewal options"
- **Cross-modal** - Search with text, find relevant documents
- **Self-hosted** - Your data stays on your infrastructure

## 🚀 Quick Start

### Option 1: Docker (Local)

```bash
# Clone and enter directory
git clone <repo-url>
cd lease-abstraction

# Create .env file
echo "GOOGLE_API_KEY=your-gemini-api-key" > .env

# Start everything
docker-compose up

# Open http://localhost:3000
```

Get a free Gemini API key at: https://makersuite.google.com/app/apikey

### Option 2: Railway (Cloud)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/lease-abstraction)

1. Click the button above
2. Add your `GOOGLE_API_KEY` environment variable
3. Deploy!

## 🔒 Enterprise Setup (Vertex AI)

For handling confidential lease documents with full data protection, use Google Vertex AI instead of the consumer Gemini API.

**See [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md)** for step-by-step instructions.

Benefits:
- Data stays within your GCP project
- SOC2, ISO 27001, HIPAA eligible
- Customer-managed encryption keys
- VPC Service Controls

## 📖 Usage

### Upload a Lease

1. Drag & drop a PDF onto the upload zone
2. Wait for processing (typically 5-10 seconds)
3. View extracted fields

### Search Your Portfolio

Try queries like:
- "leases expiring in 2025"
- "NNN leases with CAM over $5"
- "tenants in Seattle"
- "renewal options available"
- "rent escalation above 3%"

### Extracted Fields

The tool automatically extracts:
- Tenant & Landlord names
- Premises address
- Square footage
- Lease term (start/end dates)
- Monthly base rent
- Rent escalations
- Security deposit
- CAM/NNN charges
- Lease type (Gross, Modified Gross, NNN)
- Renewal options
- Termination clauses
- Permitted use

## 🛠 Configuration

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Gemini API key (consumer) |
| `USE_VERTEX=true` | Enable Vertex AI (enterprise) |
| `VERTEX_PROJECT` | GCP Project ID |
| `VERTEX_LOCATION` | GCP Region (default: us-central1) |
| `QDRANT_URL` | Qdrant connection URL |
| `PORT` | Server port (default: 3000) |

## 📁 Project Structure

```
lease-abstraction/
├── docker-compose.yml    # Docker setup
├── Dockerfile
├── package.json
├── railway.toml          # Railway config
├── src/
│   └── server.js         # Backend API
├── public/
│   └── index.html        # Web UI
├── docs/
│   └── SETUP-GUIDE.md    # Enterprise setup guide
├── test-data/            # Sample leases
└── uploads/              # Uploaded files (gitignored)
```

## 🧪 Test Data

Sample lease documents are included in `test-data/`:
- `sample-lease-1.txt` - Modified Gross office lease
- `sample-lease-2.txt` - Triple Net retail lease

Convert to PDF using any tool (Google Docs, LibreOffice, etc.) for testing.

## 💰 Costs

| Component | Free Tier | Estimated Cost |
|-----------|-----------|----------------|
| Gemini API | 1,500 req/day | ~$0.00025/1k chars |
| Vertex AI | $300 credit | ~$0.0001/embedding |
| Railway | 500 hrs/mo | $5/mo hobby plan |
| Qdrant | 1GB free | $25/mo starter |

**Typical firm (100 leases/month): ~$10-20/month**

## 🤝 Support

Built for the commercial real estate community.

Questions? Issues? Open a GitHub issue or reach out.

## 📜 License

MIT License - use it however you want.
