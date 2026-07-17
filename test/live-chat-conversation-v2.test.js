/**
 * Conversation pipeline v2 — routing, money, state, tracking answers.
 * Run: node --test test/live-chat-conversation-v2.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveRoute,
  trackingAnswer,
} = require('../src/services/live-chat-conversation.service');
const {
  ensureConversationState,
  mergeEntities,
  applyCorrections,
  setCurrentGoal,
  switchWorkflow,
  SCHEMA_VERSION,
} = require('../src/services/live-chat-conversation-state.service');
const {
  normalizeMoneyAmount,
  formatMoney,
  moneyObject,
} = require('../src/services/live-chat-money.service');
const {
  mergeUnderstanding,
  deterministicEntities,
  validateUnderstanding,
} = require('../src/services/live-chat-understanding.service');

describe('money normalization', () => {
  it('converts USD cents-looking integers to major units', () => {
    assert.equal(normalizeMoneyAmount(65826, 'USD'), 658.26);
    assert.equal(formatMoney(65826, 'USD'), 'USD 658.26');
    assert.equal(moneyObject(65826, 'USD').amount, '658.26');
  });

  it('keeps already-major USD amounts', () => {
    assert.equal(normalizeMoneyAmount(65.82, 'USD'), 65.82);
    assert.equal(normalizeMoneyAmount('65.82', 'USD'), 65.82);
  });

  it('does not divide zero-decimal currencies', () => {
    assert.equal(normalizeMoneyAmount(65826, 'JPY'), 65826);
  });
});

describe('conversation state v2', () => {
  it('migrates legacy workflowState', () => {
    const session = {
      workflowState: {
        activeWorkflow: 'track_order',
        collectedFields: { orderNumber: '1001', email: 'a@b.com' },
        version: 3,
      },
      pendingOrderNumber: '1001',
    };
    const state = ensureConversationState(session);
    assert.equal(state.schemaVersion, SCHEMA_VERSION);
    assert.equal(state.collectedContext.orderNumber, '1001');
    assert.equal(state.collectedContext.email, 'a@b.com');
    assert.equal(state.activeWorkflow, 'track_order');
  });

  it('applies corrections and invalidates order caches', () => {
    const session = { workflowState: null };
    const state = ensureConversationState(session);
    mergeEntities(state, { orderNumber: '1001', email: 'a@b.com' });
    state.lastToolResults = { order_lookup: { card: { orderNumber: '1001' } } };
    state.lastComponentIds = ['order-card:1001'];
    state.verifiedContext.orderNumber = '1001';
    const changed = applyCorrections(state, { orderNumber: '1002' });
    assert.ok(changed.includes('orderNumber'));
    assert.equal(state.collectedContext.orderNumber, '1002');
    assert.equal(state.verifiedContext.orderNumber, null);
    assert.equal(state.lastToolResults.order_lookup, undefined);
    assert.deepEqual(state.lastComponentIds, []);
  });

  it('extracts multi-entity wedding preferences offline', () => {
    const det = deterministicEntities(
      "It's for a wedding, I wear large, and white is fine.",
    );
    assert.equal(det.occasion, 'wedding');
    assert.equal(det.size, 'L');
    assert.equal(det.color, 'white');
  });
});

describe('resolveRoute precedence', () => {
  const state = (wf) => ({
    activeWorkflow: wf,
    expectedFields: [],
    currentGoal: null,
  });

  it('handoff beats active product workflow', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'contact_support',
        turnType: 'handoff_request',
        requestsHuman: true,
      },
      state('product_search'),
    );
    assert.equal(route.route, 'handoff');
  });

  it('new refund intent beats product workflow', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'request_refund',
        turnType: 'new_intent',
        requestsHuman: false,
      },
      state('product_search'),
    );
    assert.equal(route.route, 'return_or_refund');
  });

  it('track beats return workflow on topic switch', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'track_order',
        turnType: 'new_intent',
        requestsHuman: false,
      },
      state('return_request'),
    );
    assert.equal(route.route, 'track_order');
  });

  it('rejection routes to rejection handler', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'track_order',
        turnType: 'rejection',
        rejectsPreviousAnswer: true,
      },
      state('track_order'),
    );
    assert.equal(route.route, 'rejection');
  });

  it('correction routes to correction handler', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'track_order',
        turnType: 'correction',
        isCorrection: true,
      },
      state('track_order'),
    );
    assert.equal(route.route, 'correction');
  });

  it('field_response continues active workflow', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'unknown',
        turnType: 'field_response',
        requestsHuman: false,
      },
      state('product_search'),
    );
    assert.equal(route.route, 'product');
  });

  it('does not route track_order to continue_ai when continueWithAI is wrongly true', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'track_order',
        turnType: 'new_intent',
        continueWithAI: true,
        requestsHuman: false,
      },
      { activeWorkflow: null },
    );
    assert.equal(route.route, 'track_order');
  });
});

describe('trackingAnswer goal separation', () => {
  it('does not lead with financial dump for refunded orders', () => {
    const answer = trackingAnswer({
      orderNumber: '1001',
      financialStatus: 'refunded',
      fulfillmentStatus: 'restocked',
    });
    assert.equal(answer.responseType, 'tracking_unavailable_refunded');
    assert.equal(answer.includeCard, false);
    assert.match(answer.suggestedText, /does not have a shipment/i);
    assert.doesNotMatch(answer.suggestedText, /financial status is/i);
  });

  it('reports not shipped for unfulfilled', () => {
    const answer = trackingAnswer({
      orderNumber: '1002',
      financialStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
    });
    assert.equal(answer.responseType, 'not_shipped');
  });
});

describe('understanding schema', () => {
  it('accepts primaryIntent schema and keeps intent alias', () => {
    const parsed = validateUnderstanding({
      primaryIntent: 'track_order',
      turnType: 'new_intent',
      entities: { orderNumber: '#1002', email: 'A@B.COM' },
      confidence: 0.95,
    });
    assert.equal(parsed.primaryIntent, 'track_order');
    assert.equal(parsed.intent, 'track_order');
    assert.equal(parsed.entities.orderNumber, '1002');
    assert.equal(parsed.entities.email, 'a@b.com');
  });

  it('mergeUnderstanding extracts order+email together', () => {
    const merged = mergeUnderstanding({
      text: 'Order 1001, kashif@example.com',
      llm: null,
    });
    assert.equal(merged.entities.orderNumber, '1001');
    assert.equal(merged.entities.email, 'kashif@example.com');
  });
});

describe('goal switch sequence (state machine)', () => {
  it('product → refund → track without lock-in', () => {
    const session = { workflowState: null };
    const state = ensureConversationState(session);
    setCurrentGoal(state, 'product_recommendation', 'shop');
    switchWorkflow(state, { workflow: 'product_search', step: 'search', reason: 'start' });

    let route = resolveRoute(
      { primaryIntent: 'request_refund', turnType: 'new_intent' },
      state,
    );
    assert.equal(route.route, 'return_or_refund');
    switchWorkflow(state, { workflow: 'return_request', reason: 'switch' });
    setCurrentGoal(state, 'request_refund', 'refund');

    route = resolveRoute(
      { primaryIntent: 'track_order', turnType: 'new_intent' },
      state,
    );
    assert.equal(route.route, 'track_order');
  });
});
