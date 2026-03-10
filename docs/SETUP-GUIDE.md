# Lease Abstraction Tool - Setup Guide

**Total time: ~20 minutes (AI does most of the work)**

You only need to:
1. Login to Google Cloud Console
2. Login to Railway
3. Copy/paste prompts to Claude or ChatGPT
4. Click approve on a few things

The AI handles all the technical details.

---

## Prerequisites

- Google account (for Google Cloud)
- GitHub account (for Railway deployment)
- Claude Pro, ChatGPT Plus, or API access

---

## Step 1: Google Cloud Setup (10 min)

### 1.1 Create Project & Enable APIs

**Login to Google Cloud Console:** https://console.cloud.google.com

Then copy this ENTIRE prompt to Claude/ChatGPT:

```
I need you to help me set up Google Cloud for a Vertex AI application. I'm logged into the Google Cloud Console. Give me step-by-step instructions with exact buttons to click:

1. Create a new project called "lease-abstraction"
2. Enable the Vertex AI API
3. Create a service account called "lease-app" with Vertex AI User role
4. Generate a JSON key for the service account

For each step, tell me:
- Exact URL to go to
- Exact buttons/links to click
- What to type in each field
- What to select from dropdowns

I will paste back any error messages or questions. Guide me through the entire process.
```

**Follow the AI's instructions. When done, you'll have a JSON file downloaded.**

### 1.2 Get Your Project ID

Your project ID is shown in the Google Cloud Console URL and dashboard.
It looks like: `lease-abstraction-123456`

Save this - you'll need it for Railway.

---

## Step 2: Railway Deployment (10 min)

### 2.1 Create Railway Account & Project

**Go to:** https://railway.app

Login with GitHub, then copy this prompt to your AI:

```
I need to deploy a Docker application to Railway. I'm logged into railway.app. Walk me through:

1. Creating a new empty project
2. Adding a service from a GitHub repo: [PASTE YOUR REPO URL]
3. Adding a Qdrant database service
4. Setting these environment variables on my app service:
   - USE_VERTEX = true
   - VERTEX_PROJECT = [I'LL TELL YOU MY PROJECT ID]
   - VERTEX_LOCATION = us-central1
   - GOOGLE_APPLICATION_CREDENTIALS_JSON = [I'LL PASTE MY SERVICE ACCOUNT JSON]
5. Getting my public deployment URL

For each step tell me exactly what to click and where.
```

When the AI asks:
- **Project ID:** Give it the ID from Step 1.2
- **Service Account JSON:** Open the JSON file you downloaded, copy ALL of it, paste it

### 2.2 Verify Deployment

Once deployed, Railway gives you a URL like: `lease-abstraction-production.up.railway.app`

Open it. You should see the Lease Abstraction Tool interface.

---

## Step 3: Test It

1. Download a sample lease PDF (or use any commercial lease)
2. Drag & drop it onto the upload zone
3. Wait 10-15 seconds for processing
4. See extracted fields appear
5. Try searching: "what is the monthly rent"

---

## Troubleshooting Prompts

If something doesn't work, copy the error message and use these prompts:

### API Permission Error
```
I'm getting this error in my Vertex AI application: [PASTE ERROR]

I have a Google Cloud project called "lease-abstraction" and a service account called "lease-app". 

Help me fix the permissions. Tell me exact steps in Google Cloud Console.
```

### Railway Build Error
```
My Railway deployment is failing with this error: [PASTE ERROR]

The app is a Node.js Docker application using Vertex AI. Help me fix it.
```

### Qdrant Connection Error
```
My app can't connect to Qdrant on Railway. The error is: [PASTE ERROR]

I have a Qdrant service running in the same Railway project. Help me fix the connection.
```

---

## Environment Variables Reference

| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| `USE_VERTEX` | `true` | Just type this |
| `VERTEX_PROJECT` | `lease-abstraction-123456` | Google Cloud Console, top of page |
| `VERTEX_LOCATION` | `us-central1` | Just type this |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | `{"type":"service_account",...}` | The JSON file you downloaded |

---

## Security Notes

- ✅ Your lease documents are processed by Google's Vertex AI
- ✅ Vertex AI is SOC2, ISO 27001, HIPAA eligible
- ✅ Data is encrypted in transit and at rest
- ✅ Service account has minimal permissions (Vertex AI User only)
- ✅ Your Qdrant database is private to your Railway project

---

## Cost Estimate

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Google Cloud | $300 credit (90 days) | ~$0.01 per lease |
| Railway | 500 hours/month | $5/month hobby |
| **Total** | **Free for months** | **~$10/month** |

---

## Need Help?

Copy this entire document to Claude/ChatGPT and say:

```
I'm trying to set up this lease abstraction tool. I'm stuck at [DESCRIBE WHERE YOU ARE]. Here's what I see on my screen: [DESCRIBE OR SCREENSHOT]. Help me continue.
```

The AI has full context and can guide you through any step.
