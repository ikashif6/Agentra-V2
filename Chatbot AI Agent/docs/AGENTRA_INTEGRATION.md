# Agentra integration points (not connected yet)

This chatbot is production-ready as a **standalone** service. Agentra will later supply workspace data through the contracts in `apps/server/src/workspace/`.

## Priority order (do not invert)

1. Safety, privacy, security, workspace isolation  
2. Backend permissions and verified action results  
3. Connected-store facts and workspace policies  
4. Enabled / disabled features  
5. Store-owner and channel-specific instructions (tone / style only)  
6. Default chatbot tone and wording  

Store-owner instructions may shape **how** the bot communicates. They must never override privacy, verification, permissions, verified facts, feature flags, or tool outcomes. Core rules live in `apps/server/src/ai/prompts.ts` and stay separate from owner text.

## Current provider

`LocalWorkspaceConfigProvider` resolves config from:

1. Environment variables (see `.env.example`)
2. Optional overlay: `apps/server/data/workspace/{workspaceId}/config.json`  
   (copy from `config.example.json`)

## Future Agentra provider

Implement `WorkspaceConfigProvider` and call:

```ts
import { setWorkspaceConfigProvider, AgentraWorkspaceConfigProvider, maybeConnectAgentraWorkspaceProvider } from "./workspace/index.js";
// Preferred:
maybeConnectAgentraWorkspaceProvider();
// Or manual:
// setWorkspaceConfigProvider(new AgentraWorkspaceConfigProvider());
```

Agentra exposes bridge APIs under `/api/v1/chatbot-bridge/*` (shared secret header `x-chatbot-bridge-secret`):

- `GET /workspaces/:id/config`
- `GET /workspaces/:id/knowledge`
- `GET /workspaces/:id/availability`
- product/order/refund/tracking commerce routes

Set on the chatbot:

```
AGENTRA_API_URL=http://localhost:5000/api/v1
AGENTRA_WORKSPACE_PROVIDER=agentra
CHATBOT_BRIDGE_SECRET=...
# optional: COMMERCE_PROVIDER=agentra
```

Set on Agentra:

```
CHATBOT_ENGINE_ENABLED=true
CHATBOT_ENGINE_URL=http://localhost:5600
CHATBOT_BRIDGE_SECRET=...
AI_CONVERSATION_PIPELINE=chatbot
```

`WORKSPACE_ID` on the chatbot should match the Agentra company subdomain (or Mongo id).

Expected Agentra inputs (already typed):

| Input | Field |
|--------|--------|
| Policies / knowledge | `knowledge` (+ local files today) |
| Products, orders, stock, refunds | commerce adapters (Shopify / Woo / custom) |
| Discounts | `commerce.knownCoupons` |
| Business hours / contact | `businessHours`, `branding.contact*` |
| Human-agent availability | `businessHours.agentsAvailable` |
| Feature toggles | `features` |
| Store-owner AI instructions | `ownerInstructions` |
| Channel-specific wording | `channelInstructions` |

Do **not** merge owner instructions into the core system rules. Use `formatOwnerBehaviourLayer()` only as the priority-5 prompt section.

## Feature gates

Tools are mapped in `workspace/features.ts`. Disabled features return `FEATURE_DISABLED` from `executeTool` before handlers run.

## Demo sandbox

`COMMERCE_PROVIDER=custom` sets `allowDemoSandboxData: true` (demo catalog + demo coupons for local tests only). Production Shopify/Woo workspaces keep this false and never invent promos.
