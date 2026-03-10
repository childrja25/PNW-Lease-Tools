# Test Data

This folder contains sample lease documents for testing.

## Generating Test PDFs

Since we can't include real leases, here are some resources for test data:

### Option 1: Use Public Lease Templates

Download free commercial lease templates from:
- LawDepot: https://www.lawdepot.com/contracts/commercial-lease-agreement/
- Rocket Lawyer: https://www.rocketlawyer.com/business-and-contracts/real-estate/commercial-lease
- LegalZoom: https://www.legalzoom.com/forms/commercial-lease-agreement

### Option 2: Generate Sample PDFs

Run this script to create test PDFs (requires `pdfkit`):

```bash
npm install pdfkit
node generate-test-leases.js
```

### Option 3: Use Your Own Documents

For the best test, use actual lease documents from your portfolio.
The tool supports PDFs up to 50MB and 6 pages per embedding request.

## Test Scenarios

Once you have test PDFs, try these searches:

1. "leases with base rent over $20 per square foot"
2. "triple net NNN agreements"
3. "5 year lease terms with renewal options"
4. "leases expiring in 2027"
5. "CAM reconciliation clauses"
6. "personal guarantee requirements"
7. "assignment and subletting provisions"
