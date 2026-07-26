# Ecommerce Customer-Support Chatbot

Independent greenfield chatbot (Gorgias-style). Visual design matched from `chatbot-design`; all backend, tools, and conversation logic are new.

## Quick start

```bash
# From Chatbot AI Agent/
cp .env.example .env
# Add GROQ_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY)

npm install
npm run build -w @chatbot/shared
npm run dev
```

In another terminal:

```bash
npm run dev:widget
```

Open http://localhost:5500

- API: http://localhost:5600
- Health: http://localhost:5600/health (public liveness only)
- Diagnostics: http://localhost:5600/health/diagnostics (requires `HEALTH_DIAGNOSTICS_TOKEN` + `x-health-token` header)

## Env

See `.env.example`.

### Groq
Set `AI_PROVIDER=groq` and a valid `GROQ_API_KEY` from https://console.groq.com/keys

### Shopify
Set `COMMERCE_PROVIDER=shopify` and either:

1. **Admin API token** (simplest): paste into `SHOPIFY_ADMIN_TOKEN` (or `SHOPIFY_ACCESS_TOKEN`) plus `SHOPIFY_STORE_DOMAIN`
2. **OAuth install** (custom app distribution): set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_STORE_DOMAIN`, ensure redirect URI `http://localhost:5600/shopify/callback` is allowlisted in the Partner Dashboard, then open:

```
http://localhost:5600/shopify/install
```

Status: `http://localhost:5600/shopify/status`

Default without Shopify credentials: `COMMERCE_PROVIDER=custom` uses a seed catalog/orders for local testing.

## Structure

- `apps/server` — conversation engine, tools, commerce adapters, knowledge, handoff, workspace config
- `apps/widget` — embeddable chat UI (design-matched)
- `packages/shared` — shared DTOs
- `docs/AGENTRA_INTEGRATION.md` — future Agentra wiring (not connected yet)

## Workspace config (production)

Brand, hours, features, coupons, and optional store-owner **tone** instructions resolve through `apps/server/src/workspace/`.

- Env defaults are brand-neutral (`Store` / `Store Assistant`)
- Optional file: `apps/server/data/workspace/{id}/config.json`
- Owner instructions are a separate priority-5 behaviour layer — they cannot override safety, verification, facts, or tools

See `docs/AGENTRA_INTEGRATION.md`.

## Tests

```bash
npm test
```
