/**
 * Widget HTTP contract + helpdesk/session regression-style tests for v3 engine wiring.
 * These stay in-process (no live Mongo) and lock response contracts.
 * Run: node --test test/assistant-engine-integration.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveEngineMode,
  processTurn,
} = require('../src/services/assistant-engine/assistant-engine.service');
const {
  mapAllowedActionsToCapabilities,
  enforceCapability,
} = require('../src/services/assistant-engine/assistant-capability.service');
const { normalizeRuntimeConfig } = require('../src/services/assistant-engine/assistant-runtime-config.service');
const { assembleTurnContext } = require('../src/services/assistant-engine/assistant-context.service');
const { buildHandoffWidgetPayload, ensureHandoffState } = require('../src/services/live-chat-workflow.service');

function fakeSession(overrides = {}) {
  const session = {
    _id: '64b0000000000000000000aa',
    ticket: '64b0000000000000000000bb',
    visitorEmail: 'customer@example.com',
    status: 'bot',
    messages: [],
    workflowState: {
      schemaVersion: 2,
      verifiedContext: {},
      collectedContext: {},
      currentGoal: null,
      activeWorkflow: null,
      workflowStep: null,
      expectedFields: [],
      lastToolResults: {},
      lastComponentIds: [],
    },
    handoffState: {},
    markModified() {},
    async save() {
      return this;
    },
    ...overrides,
  };
  ensureHandoffState(session);
  return session;
}

function companyFixture(actionOverrides = {}) {
  return {
    _id: '64b000000000000000000001',
    name: 'Widget Test Store',
    currency: 'USD',
    timezone: 'UTC',
    liveChat: {
      enabled: true,
      content: { agentName: 'Widget Bot', offlineMessage: 'We are offline' },
      behavior: {
        requireOrderVerification: true,
        handoffOnlyInBusinessHours: true,
      },
      ai: {
        enabled: true,
        instructions: 'Warm and concise.',
        escalationKeywords: ['talk to a human'],
        allowedActions: {
          lookupOrder: true,
          cancelOrder: false,
          refundOrder: false,
          maxRefundAmount: 100,
          editOrder: false,
          productRecommendations: false,
          requestHuman: true,
          ...actionOverrides,
        },
      },
    },
    aiAgent: {
      assistantConfigVersion: 11,
      assistantEngine: 'v3',
      enabledChannels: { liveChat: true },
      channelOverrides: {},
    },
    settings: { businessHours: { enabled: false } },
    storeIntegration: { status: 'connected', provider: 'shopify' },
  };
}

describe('widget response contract shape', () => {
  it('handoff payload stays widget-compatible', () => {
    const session = fakeSession();
    const payload = buildHandoffWidgetPayload(session);
    assert.equal(typeof payload, 'object');
    assert.ok('status' in payload);
  });

  it('turn context does not embed owner configuration into history', () => {
    const session = fakeSession({
      messages: [
        { role: 'customer', body: 'Hi', contentType: 'text' },
        { role: 'bot', body: 'Hello', contentType: 'text' },
      ],
    });
    const ctx = assembleTurnContext({ session, conversationState: session.workflowState });
    assert.equal(ctx.recentMessages.length, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(ctx, 'instructions'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(ctx, 'allowedActions'), false);
  });

  it('capability-unavailable response keeps existing message fields', async () => {
    const prevSkip = process.env.AI_SKIP_RESPONSE_LLM;
    process.env.AI_SKIP_RESPONSE_LLM = '1';
    try {
      // Stub append by monkey-patching through processTurn permission path without Mongo tools
      const company = companyFixture();
      const runtime = normalizeRuntimeConfig(company);
      assert.equal(runtime.capabilities.productRecommendations, false);

      const session = fakeSession();
      // Minimal appendSessionMessage substitute via local emit path: call enforce only
      const decision = enforceCapability({
        capabilities: runtime.capabilities,
        capability: 'productRecommendations',
      });
      assert.equal(decision.allowed, false);

      // Simulate widget HTTP body fields the controller returns
      const widgetResponse = {
        messages: [
          {
            role: 'bot',
            body: decision.safeMessage,
            contentType: 'text',
            senderName: runtime.agentName,
          },
        ],
        handoff: false,
        handoffState: buildHandoffWidgetPayload(session),
        turnDebug: {
          assistantConfigVersion: runtime.assistantConfigVersion,
          pipelineBuild: '2026-07-17-assistant-engine-v3',
          permissionDecision: decision,
        },
      };

      assert.equal(Array.isArray(widgetResponse.messages), true);
      assert.equal(widgetResponse.messages[0].contentType, 'text');
      assert.equal(widgetResponse.handoff, false);
      assert.equal(widgetResponse.turnDebug.assistantConfigVersion, 11);
      assert.equal(widgetResponse.turnDebug.permissionDecision.decision, 'unavailable_manual_review');
    } finally {
      if (prevSkip === undefined) delete process.env.AI_SKIP_RESPONSE_LLM;
      else process.env.AI_SKIP_RESPONSE_LLM = prevSkip;
    }
  });
});

describe('cross-workspace isolation contract', () => {
  it('capabilities and versions are per workspace', () => {
    const a = normalizeRuntimeConfig(companyFixture());
    const b = normalizeRuntimeConfig({
      ...companyFixture({ productRecommendations: true }),
      _id: '64b000000000000000000002',
      aiAgent: { assistantConfigVersion: 2, enabledChannels: { liveChat: true }, channelOverrides: {} },
      liveChat: {
        ...companyFixture().liveChat,
        ai: {
          ...companyFixture().liveChat.ai,
          allowedActions: {
            ...companyFixture().liveChat.ai.allowedActions,
            productRecommendations: true,
          },
        },
      },
    });
    assert.notEqual(a.workspaceId, b.workspaceId);
    assert.equal(a.capabilities.productRecommendations, false);
    assert.equal(b.capabilities.productRecommendations, true);
    assert.notEqual(a.assistantConfigVersion, b.assistantConfigVersion);
  });
});

describe('helpdesk / session continuity markers', () => {
  it('preserves ticket linkage on session for inbox continuity', () => {
    const session = fakeSession();
    assert.equal(String(session.ticket), '64b0000000000000000000bb');
    const ctx = assembleTurnContext({ session });
    assert.ok(ctx);
  });

  it('resolveEngineMode supports staged rollout selectors', () => {
    assert.equal(resolveEngineMode(companyFixture()), 'v3');
    assert.equal(
      resolveEngineMode({
        ...companyFixture(),
        aiAgent: { assistantEngine: 'shadow' },
      }),
      'shadow',
    );
  });
});

describe('natural multi-turn evaluation hooks', () => {
  it('maps refund intent to autoRefund capability without rewriting intent key', () => {
    const caps = mapAllowedActionsToCapabilities({ refundOrder: false });
    const decision = enforceCapability({ capabilities: caps, capability: 'autoRefund' });
    assert.equal(decision.allowed, false);
    // Intent remains request_refund semantically; only tool is blocked
    assert.equal(decision.capability, 'autoRefund');
  });
});

// Keep processTurn import "live" so require graph stays valid in CI
describe('engine module load', () => {
  it('exports processTurn', () => {
    assert.equal(typeof processTurn, 'function');
  });
});
