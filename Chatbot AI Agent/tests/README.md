# Testing Guide — Vastora / Agentra Chatbot

## Safety

- Use **custom commerce** for destructive tests (`COMMERCE_PROVIDER=custom`).
- Clear `RESEND_API_KEY` on the test process so emails only log.
- Do **not** cancel/change/refund live Shopify orders.

## Unit tests

```bash
npm test
```

## Isolated API harness

Terminal 1 — test server:

```powershell
cd apps/server
$env:PORT="5610"
$env:HOST="127.0.0.1"
$env:WORKSPACE_ID="vastora-test"
$env:COMMERCE_PROVIDER="custom"
$env:SHOPIFY_ALLOW_WRITES="false"
$env:RESEND_API_KEY=""
# Keep OPENAI_* from your root .env for AI turns
npx tsx src/index.ts
```

Terminal 2 — suite:

```powershell
$env:TEST_API_BASE="http://127.0.0.1:5610"
$env:TEST_WORKSPACE_ID="vastora-test"
$env:TEST_WIDGET_BASE="http://127.0.0.1:5500"
node tests/api/run-complete-suite.mjs
```

## Report

```bash
node tests/reports/generate-report.mjs
```

Outputs:

- `Agentra_Chatbot_Complete_Test_Report.md`
- `Agentra_Chatbot_Complete_Test_Report.pdf`
- `tests/reports/results.json`

## Manual still required

- Mobile widget UX / Playwright journeys
- WooCommerce
- Shopify write mutations on a disposable shop only
- Accessibility + Arabic RTL
- Chaos (bad AI key, SSE drop, load)
