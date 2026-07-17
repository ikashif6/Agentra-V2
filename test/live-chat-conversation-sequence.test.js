/**
 * Sequence routing expectations for the failing live conversation.
 * Does not call Groq / Shopify — validates turn-route transitions only.
 * Run: node --test test/live-chat-conversation-sequence.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  matchDeterministicIntent,
  resolveTurnRoute,
  switchWorkflow,
} = require('../src/services/live-chat-turn-route.service');

const SEQUENCE = [
  { message: 'Where is my Order?', expectIntent: 'track_order', expectWorkflow: 'track_order' },
  {
    message: 'Order #1001, kashif.61764@iqra.edu.pk',
    // identity continuation — no deterministic switch required
    expectIntent: null,
    expectWorkflow: 'track_order',
    continueActive: true,
  },
  {
    message: "I haven't received the payment",
    expectIntent: 'refund_not_received',
    expectWorkflow: 'refund_investigation',
  },
  {
    message: 'connect me with an agent',
    expectIntent: 'speak_to_human',
    expectWorkflow: 'handoff',
  },
  {
    message: 'where can I leave contact details',
    expectIntent: 'start_contact_request',
    expectWorkflow: 'contact_request',
  },
  {
    message: 'I want to track my order',
    expectIntent: 'track_order',
    expectWorkflow: 'track_order',
  },
  {
    message: 'recommend me product',
    expectIntent: 'product_search',
    expectWorkflow: 'product_search',
  },
  {
    message: 'I need a refund',
    expectIntent: 'refund_request',
    expectWorkflow: 'refund',
  },
];

describe('failing live conversation sequence (routing)', () => {
  it('routes every explicit turn correctly without workflow lock-in', () => {
    let activeWorkflow = null;
    let expectedFields = [];

    for (const turn of SEQUENCE) {
      const det = matchDeterministicIntent(turn.message);
      const route = resolveTurnRoute({
        latestMessage: turn.message,
        detectedIntent: det?.intent || 'unknown',
        confidence: det?.confidence || 0.5,
        activeWorkflow,
        expectedFields,
      });

      if (turn.continueActive) {
        assert.equal(
          route.workflow || activeWorkflow,
          turn.expectWorkflow,
          `continue failed for: ${turn.message}`,
        );
        continue;
      }

      assert.equal(route.intent, turn.expectIntent, `intent for: ${turn.message}`);
      assert.equal(route.workflow, turn.expectWorkflow, `workflow for: ${turn.message}`);

      const session = {
        workflowState: {
          activeWorkflow,
          workflowStep: activeWorkflow === 'product_search' ? 'collect_missing_preferences' : null,
          collectedFields: { productQuery: activeWorkflow === 'product_search' ? 'x' : null },
          version: 0,
        },
      };
      switchWorkflow(session, {
        workflow: route.workflow,
        intent: route.intent,
        reason: route.reason,
      });
      activeWorkflow = session.workflowState.activeWorkflow;
      expectedFields =
        activeWorkflow === 'product_search' ? ['occasion', 'size', 'color', 'budget'] : [];
    }

    assert.equal(activeWorkflow, 'refund');
  });
});
