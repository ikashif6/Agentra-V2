# Config-Aware Assistant Engine — Rollout

This document is the operational checklist for promoting the v3 assistant engine.
Do not delete v2 during rollout; it remains the immediate rollback path.

## Feature flags

| Flag / field | Purpose |
|---|---|
| `AI_CONVERSATION_PIPELINE` | Global default: `v2` (safe), `v3`, `shadow`, or `v1` |
| `AI_ASSISTANT_V3_KILL_SWITCH=true` | Forces every workspace back to **v2** immediately |
| `Company.aiAgent.assistantEngine` | Per-workspace override: `v2` \| `v3` \| `shadow` \| `v1` |
| `AI_DISABLE_LEGACY_CHAT_FALLBACK` | Keep `true` (default) — no free-form legacy answers |
| `AI_SKIP_RESPONSE_LLM=1` | Deterministic suggestedText only (tests / emergency) |

Workspace selector overrides the global pipeline. The kill switch overrides everything.

## Stages

### 1. Shadow mode (selected workspaces)

1. Set `Company.aiAgent.assistantEngine = 'shadow'` for canary workspaces.
2. v3 runs understanding / authority / permission / conflict audit only.
3. v2 still writes the customer-facing reply (no duplicate tools/writes from shadow).
4. Compare logs:
   - intent agreement
   - permission decisions
   - selected tools
   - conflict counts
   - latency
   - fallback rate

**Promotion blocker:** safety, tenant isolation, or consequential-action regressions.

### 2. Internal / Vastora canary

1. Set `assistantEngine = 'v3'` on Vastora + internal synthetic workspaces only.
2. Verify:
   - Widget HTTP multi-turn (order lookup, products, policy, handoff)
   - Helpdesk ticket creation, assignment, agent reply realtime
   - Owner instruction tone changes apply without granting disabled actions
   - Knowledge publish bumps `assistantConfigVersion` and is visible next turn
3. Manual widget acceptance: appearance/CSS unchanged; cards/forms unchanged.

### 3. Allowlist → percentage rollout

1. Expand workspace allowlist via `assistantEngine = 'v3'`.
2. Optionally set global `AI_CONVERSATION_PIPELINE=v3` only after allowlist is healthy.
3. Watch workspace-scoped conflict metrics (`AssistantConflictAudit`).

### 4. Default promotion

Promote global default to v3 only after:

- [ ] Configuration matrix tests green
- [ ] Widget HTTP + helpdesk regression suites green
- [ ] Live-model / conversation evals within baseline
- [ ] Manual widget visual check (no design drift)
- [ ] Kill-switch rollback drill succeeded

## Rollback

**One-click / immediate:**

```bash
# env
AI_ASSISTANT_V3_KILL_SWITCH=true
# or
AI_CONVERSATION_PIPELINE=v2
```

**Per workspace:**

```js
company.aiAgent.assistantEngine = 'v2';
await company.save();
```

v2 conversation services remain in tree and are not deleted during rollout.

## Metrics to review

- `assistant_instruction_conflict` counts by category (permission, verified_fact, safety, …)
- Turn audit outcomes (`ok`, `capability_unavailable`, `force_handoff`)
- Permission deny rate vs customer escalations
- Unsupported claim / generator fallback rate
- p95 turn latency vs v2 baseline
- Cross-workspace isolation: zero audits referencing foreign `company`

## Config versioning reminder

`assistantConfigVersion` increments on:

- AI Agent / live-chat AI settings
- Knowledge create / update / delete / import / publish
- Business hours changes
- Store capability/sync settings
- Product sync from live-chat settings

Runtime config cache keys: `workspaceId + channel + assistantConfigVersion`.
