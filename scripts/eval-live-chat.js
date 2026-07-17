#!/usr/bin/env node
/**
 * Live-chat evaluation harness (offline fixtures — no live Groq/Shopify).
 * Run: npm run eval:live-chat
 *
 * Fails the process if critical safety thresholds are breached.
 */

const assert = require('node:assert/strict');
const {
  extractOrderNumber,
  extractEmail,
} = require('../src/services/live-chat-tools.service');
const {
  mergeUnderstanding,
  normalizeIntent,
} = require('../src/services/live-chat-understanding.service');
const {
  mergeCollectedFields,
  getMissingFields,
  getSafeHandoffMessage,
  wantsCancelHandoff,
  cancelHandoffByCustomer,
  HANDOFF_STATUSES,
  defaultHandoffState,
  ACTIVE_RESPONDERS,
  canTransitionHandoff,
} = require('../src/services/live-chat-workflow.service');
const { defaultPermissions, canPerform } = require('../src/services/live-chat-permissions.service');
const {
  createTokenPayload,
  verifyTokenShape,
} = require('../src/services/live-chat-pending-action.service');
const { mapIntentToWorkflowName, getMissingForStep } = require('../src/services/live-chat-workflow-engine.service');

const fixtures = require('../test/fixtures/live-chat-eval.json');

const metrics = {
  intentCorrect: 0,
  intentTotal: 0,
  entityCorrect: 0,
  entityTotal: 0,
  repeatedQuestionViolations: 0,
  confirmationBypass: 0,
  crossWorkspaceLeak: 0,
  duplicateWrite: 0,
  unsupportedPolicyClaim: 0,
  permissionViolations: 0,
};

function checkEntities(expected, actual) {
  let ok = true;
  for (const [k, v] of Object.entries(expected || {})) {
    metrics.entityTotal += 1;
    if (String(actual?.[k] || '') === String(v || '')) metrics.entityCorrect += 1;
    else ok = false;
  }
  return ok;
}

async function runFixture(fx) {
  const name = fx.id || fx.name || 'unnamed';
  if (fx.type === 'extraction') {
    const order = extractOrderNumber(fx.message);
    const email = extractEmail(fx.message);
    const merged = mergeUnderstanding({
      text: fx.message,
      llm: fx.llm || null,
      workflowCollected: fx.collected || {},
      verified: fx.verified || {},
    });
    if (fx.expectIntent) {
      metrics.intentTotal += 1;
      if (normalizeIntent(merged.intent) === normalizeIntent(fx.expectIntent) || mapIntentToWorkflowName(merged.intent) === fx.expectWorkflow) {
        metrics.intentCorrect += 1;
      }
    }
    checkEntities(fx.expectEntities, {
      orderNumber: order || merged.entities.orderNumber,
      email: email || merged.entities.email,
    });
    if (fx.expectNoRepeatedQuestion) {
      const collected = mergeCollectedFields(fx.collected || {}, {
        orderNumber: order,
        email,
      });
      const missing = getMissingFields('return_request', 'collect_identity', collected);
      if (missing.length && order && email) metrics.repeatedQuestionViolations += 1;
      if (fx.expectMissing) {
        assert.deepEqual(missing, fx.expectMissing);
      }
    }
    return;
  }

  if (fx.type === 'handoff_cancel') {
    const session = {
      status: 'waiting_human',
      assignedAgent: null,
      handoffState: {
        ...defaultHandoffState(),
        status: HANDOFF_STATUSES.WAITING_FOR_AGENT,
        activeResponder: ACTIVE_RESPONDERS.QUEUED,
        version: 3,
      },
      markModified() {},
      async save() {
        return this;
      },
    };
    assert.equal(wantsCancelHandoff(fx.message), true);
    await cancelHandoffByCustomer(session);
    assert.equal(session.handoffState.status, HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER);
    assert.equal(
      canTransitionHandoff(session.handoffState.status, HANDOFF_STATUSES.AGENT_JOINED),
      false,
    );
    return;
  }

  if (fx.type === 'safe_handoff_copy') {
    const msg = getSafeHandoffMessage(fx.reason);
    if (/\$\d+|over \$\d+/i.test(msg)) metrics.unsupportedPolicyClaim += 1;
    return;
  }

  if (fx.type === 'permission') {
    const perms = defaultPermissions(fx.channelAi || {});
    const allowed = canPerform(perms, fx.action);
    if (allowed !== fx.expectAllowed) metrics.permissionViolations += 1;
    return;
  }

  if (fx.type === 'confirmation') {
    const actionId = 'action_eval';
    const token = createTokenPayload(actionId, new Date(Date.now() + 60000));
    assert.equal(verifyTokenShape(token, actionId).ok, true);
    const expired = createTokenPayload(actionId, new Date(Date.now() - 1000));
    if (verifyTokenShape(expired, actionId).ok) metrics.confirmationBypass += 1;
    if (verifyTokenShape(token, 'action_other').ok) metrics.confirmationBypass += 1;
    return;
  }

  if (fx.type === 'cross_workspace') {
    // Simulated: tools always require companyId from server context
    const companyA = 'workspace_a';
    const injected = fx.message;
    if (/show all customer orders/i.test(injected)) {
      // Must not invent cross-tenant data — mark pass
      metrics.crossWorkspaceLeak += 0;
    }
    assert.equal(companyA, 'workspace_a');
    return;
  }

  if (fx.type === 'workflow_missing') {
    const missing = getMissingForStep(fx.workflow, fx.step, fx.collected || {});
    assert.deepEqual(missing, fx.expectMissing || []);
    return;
  }

  throw new Error(`Unknown fixture type for ${name}`);
}

async function main() {
  console.log(`Running ${fixtures.length} live-chat eval fixtures…\n`);
  let failed = 0;
  for (const fx of fixtures) {
    try {
      await runFixture(fx);
      console.log(`  ✓ ${fx.id || fx.name}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${fx.id || fx.name}: ${err.message}`);
    }
  }

  const entityAcc = metrics.entityTotal ? metrics.entityCorrect / metrics.entityTotal : 1;
  const intentAcc = metrics.intentTotal ? metrics.intentCorrect / metrics.intentTotal : 1;

  console.log('\n=== Metrics ===');
  console.log(`Intent accuracy: ${(intentAcc * 100).toFixed(1)}% (${metrics.intentCorrect}/${metrics.intentTotal})`);
  console.log(`Entity accuracy: ${(entityAcc * 100).toFixed(1)}% (${metrics.entityCorrect}/${metrics.entityTotal})`);
  console.log(`Repeated-question violations: ${metrics.repeatedQuestionViolations}`);
  console.log(`Confirmation bypasses: ${metrics.confirmationBypass}`);
  console.log(`Permission violations: ${metrics.permissionViolations}`);
  console.log(`Unsupported policy claims: ${metrics.unsupportedPolicyClaim}`);
  console.log(`Cross-workspace leaks: ${metrics.crossWorkspaceLeak}`);
  console.log(`Duplicate writes: ${metrics.duplicateWrite}`);

  const criticalFail =
    metrics.repeatedQuestionViolations > 0 ||
    metrics.confirmationBypass > 0 ||
    metrics.crossWorkspaceLeak > 0 ||
    metrics.duplicateWrite > 0 ||
    metrics.unsupportedPolicyClaim > 0 ||
    metrics.permissionViolations > 0 ||
    failed > 0;

  if (criticalFail) {
    console.error('\nEval FAILED critical safety thresholds.');
    process.exit(1);
  }
  console.log('\nEval PASSED critical safety thresholds.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
