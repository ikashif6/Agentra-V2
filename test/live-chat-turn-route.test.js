/**
 * Turn-routing unit tests — explicit intents must beat active workflow.
 * Run: node --test test/live-chat-turn-route.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  matchDeterministicIntent,
  isPlausibleFieldResponse,
  resolveTurnRoute,
  switchWorkflow,
} = require('../src/services/live-chat-turn-route.service');

const {
  mergeUnderstanding,
  normalizeIntent,
} = require('../src/services/live-chat-understanding.service');

describe('matchDeterministicIntent', () => {
  it('detects handoff phrases', () => {
    assert.equal(matchDeterministicIntent('connect me with an agent').intent, 'speak_to_human');
    assert.equal(matchDeterministicIntent('talk to support').intent, 'speak_to_human');
  });

  it('detects refund not received', () => {
    assert.equal(
      matchDeterministicIntent("I haven't received the payment").intent,
      'refund_not_received',
    );
  });

  it('detects refund request without matching product', () => {
    assert.equal(matchDeterministicIntent('I need a refund').intent, 'refund_request');
  });

  it('detects track / product / contact', () => {
    assert.equal(matchDeterministicIntent('I want to track my order').intent, 'track_order');
    assert.equal(matchDeterministicIntent('recommend me product').intent, 'product_search');
    assert.equal(
      matchDeterministicIntent('where can I leave contact details').intent,
      'start_contact_request',
    );
  });
});

describe('isPlausibleFieldResponse', () => {
  it('rejects refund message as product preferences', () => {
    assert.equal(
      isPlausibleFieldResponse('I need a refund', ['occasion', 'size', 'color', 'budget']),
      false,
    );
  });

  it('accepts size / email / order', () => {
    assert.equal(isPlausibleFieldResponse('Medium', ['size']), true);
    assert.equal(isPlausibleFieldResponse('a@b.com', ['email']), true);
    assert.equal(isPlausibleFieldResponse('#1001', ['orderNumber']), true);
  });
});

describe('resolveTurnRoute', () => {
  it('switches product_search → refund on "I need a refund"', () => {
    const route = resolveTurnRoute({
      latestMessage: 'I need a refund',
      detectedIntent: 'product_recommendation',
      confidence: 0.9,
      activeWorkflow: 'product_search',
      expectedFields: ['occasion', 'size', 'color', 'budget'],
    });
    assert.equal(route.routeType, 'switch_workflow');
    assert.equal(route.workflow, 'refund');
    assert.equal(route.intent, 'refund_request');
  });

  it('switches track_order → refund_investigation on missing payment', () => {
    const route = resolveTurnRoute({
      latestMessage: "I haven't received the payment",
      detectedIntent: 'track_order',
      confidence: 0.8,
      activeWorkflow: 'track_order',
      expectedFields: [],
    });
    assert.equal(route.workflow, 'refund_investigation');
    assert.equal(route.intent, 'refund_not_received');
  });

  it('switches any workflow → handoff', () => {
    const route = resolveTurnRoute({
      latestMessage: 'connect me with an agent',
      detectedIntent: 'unknown',
      confidence: 0.2,
      activeWorkflow: 'product_search',
      expectedFields: ['size'],
    });
    assert.equal(route.workflow, 'handoff');
    assert.equal(route.intent, 'speak_to_human');
  });

  it('switches product → track_order', () => {
    const route = resolveTurnRoute({
      latestMessage: 'I want to track my order',
      detectedIntent: 'product_search',
      activeWorkflow: 'product_search',
      expectedFields: ['occasion'],
    });
    assert.equal(route.workflow, 'track_order');
  });
});

describe('switchWorkflow', () => {
  it('archives previous workflow and clears product query', () => {
    const session = {
      workflowState: {
        activeWorkflow: 'product_search',
        workflowStep: 'collect_missing_preferences',
        activeIntent: 'product_search',
        collectedFields: { productQuery: 'wedding dress', orderNumber: '1001', email: 'a@b.com' },
        version: 1,
      },
    };
    switchWorkflow(session, {
      workflow: 'refund',
      intent: 'refund_request',
      reason: 'explicit_new_intent',
    });
    assert.equal(session.workflowState.activeWorkflow, 'refund');
    assert.equal(session.workflowState.previousWorkflow, 'product_search');
    assert.equal(session.workflowState.collectedFields.orderNumber, '1001');
    assert.equal(session.workflowState.collectedFields.productQuery, null);
    assert.equal(session.workflowState.workflowStep, null);
  });
});

describe('understanding heuristics', () => {
  it('does not classify "I need a refund" as product', () => {
    const u = mergeUnderstanding({ text: 'I need a refund', llm: null });
    assert.equal(normalizeIntent(u.intent), 'request_refund');
  });

  it('classifies connect me with an agent as handoff', () => {
    const u = mergeUnderstanding({
      text: 'connect me with an agent',
      llm: { intent: 'product_recommendation', confidence: 0.9, entities: {} },
    });
    assert.equal(u.intent, 'contact_support');
  });
});
