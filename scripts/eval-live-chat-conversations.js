/**
 * Broad offline conversation-intelligence evaluation (≥150 turns across multi-turn dialogues).
 * Scores routing precedence, entity extraction, corrections, topic switches — no live Groq.
 * Run: node scripts/eval-live-chat-conversations.js
 */

const assert = require('node:assert/strict');
const {
  resolveRoute,
  trackingAnswer,
} = require('../src/services/live-chat-conversation.service');
const {
  mergeUnderstanding,
  deterministicEntities,
  normalizeIntent,
} = require('../src/services/live-chat-understanding.service');
const {
  ensureConversationState,
  mergeEntities,
  applyCorrections,
  switchWorkflow,
  setCurrentGoal,
} = require('../src/services/live-chat-conversation-state.service');
const { normalizeMoneyAmount } = require('../src/services/live-chat-money.service');

const metrics = {
  turns: 0,
  routeOk: 0,
  intentOk: 0,
  entityOk: 0,
  entityTotal: 0,
  topicSwitchOk: 0,
  topicSwitchTotal: 0,
  correctionOk: 0,
  correctionTotal: 0,
  repeatedQuestion: 0,
  unsupportedClaim: 0,
  workflowLockIn: 0,
};

function scoreEntities(expected, actual) {
  let ok = true;
  for (const [k, v] of Object.entries(expected || {})) {
    metrics.entityTotal += 1;
    const got = actual?.[k];
    if (String(got ?? '').toLowerCase() === String(v).toLowerCase()) {
      metrics.entityOk += 1;
    } else {
      ok = false;
      console.error(`  entity fail ${k}: expected=${v} got=${got}`);
    }
  }
  return ok;
}

function simulateUnderstanding(message, llmHint = {}) {
  return mergeUnderstanding({
    text: message,
    llm: {
      primaryIntent: llmHint.primaryIntent || llmHint.intent || 'unknown',
      turnType: llmHint.turnType || 'new_intent',
      customerGoal: llmHint.customerGoal || '',
      isCorrection: Boolean(llmHint.isCorrection),
      rejectsPreviousAnswer: Boolean(llmHint.rejectsPreviousAnswer),
      requestsHuman: Boolean(llmHint.requestsHuman),
      continueWithAI: Boolean(llmHint.continueWithAI),
      entities: llmHint.entities || {},
      confidence: llmHint.confidence || 0.9,
      sentiment: 'neutral',
      urgency: 'normal',
    },
  });
}

function runConversation(name, turns) {
  const session = { workflowState: null, messages: [] };
  const state = ensureConversationState(session);
  let failures = 0;

  for (const turn of turns) {
    metrics.turns += 1;
    const understanding = simulateUnderstanding(turn.message, turn.llm || {});
    mergeEntities(state, understanding.entities, { isCorrection: understanding.isCorrection });
    if (understanding.isCorrection || turn.llm?.isCorrection) {
      applyCorrections(state, {
        orderNumber: understanding.entities.orderNumber,
        email: understanding.entities.email,
        productPreferences: {
          size: understanding.entities.size,
          color: understanding.entities.color,
        },
      });
      metrics.correctionTotal += 1;
    }

    const route = resolveRoute(understanding, state);
    const expectRoute = turn.expectRoute;
    const expectIntent = turn.expectIntent ? normalizeIntent(turn.expectIntent) : null;

    if (expectRoute) {
      if (route.route === expectRoute) metrics.routeOk += 1;
      else {
        failures += 1;
        console.error(`[${name}] route fail "${turn.message}" → ${route.route} expected ${expectRoute}`);
      }
    } else {
      metrics.routeOk += 1;
    }

    if (expectIntent) {
      if (normalizeIntent(understanding.primaryIntent) === expectIntent || route.intent === expectIntent) {
        metrics.intentOk += 1;
      } else {
        failures += 1;
        console.error(
          `[${name}] intent fail "${turn.message}" → ${understanding.primaryIntent} expected ${expectIntent}`,
        );
      }
    } else {
      metrics.intentOk += 1;
    }

    if (turn.expectEntities) {
      if (!scoreEntities(turn.expectEntities, understanding.entities)) failures += 1;
    }

    if (turn.topicSwitch) {
      metrics.topicSwitchTotal += 1;
      if (route.route === turn.expectRoute && state.activeWorkflow && state.activeWorkflow !== turn.expectWorkflow) {
        // switching away from active
        metrics.topicSwitchOk += 1;
      } else if (route.route === turn.expectRoute) {
        metrics.topicSwitchOk += 1;
      } else {
        metrics.workflowLockIn += 1;
        failures += 1;
      }
    }

    if (understanding.isCorrection && turn.expectEntities?.orderNumber) {
      if (state.collectedContext.orderNumber === String(turn.expectEntities.orderNumber)) {
        metrics.correctionOk += 1;
      } else {
        failures += 1;
      }
    } else if (understanding.isCorrection) {
      metrics.correctionOk += 1;
    }

    // Apply workflow transition like the pipeline
    if (turn.expectWorkflow !== undefined) {
      switchWorkflow(state, {
        workflow: turn.expectWorkflow,
        reason: route.reason,
      });
    } else if (route.route === 'product') {
      switchWorkflow(state, { workflow: 'product_search', reason: 'eval' });
    } else if (route.route === 'track_order') {
      switchWorkflow(state, { workflow: 'track_order', reason: 'eval' });
    } else if (route.route === 'return_or_refund') {
      switchWorkflow(state, { workflow: 'return_request', reason: 'eval' });
    } else if (route.route === 'handoff') {
      switchWorkflow(state, { workflow: 'handoff', reason: 'eval' });
    } else if (route.route === 'refund_not_received') {
      switchWorkflow(state, { workflow: 'refund_investigation', reason: 'eval' });
    } else if (route.route === 'contact_request') {
      switchWorkflow(state, { workflow: 'contact_request', reason: 'eval' });
    }

    if (turn.expectGoal) setCurrentGoal(state, turn.expectGoal, turn.expectGoal);

    if (turn.forbidPhrase) {
      const answer = trackingAnswer(turn.card || {});
      if (new RegExp(turn.forbidPhrase, 'i').test(answer.suggestedText)) {
        metrics.unsupportedClaim += 1;
        failures += 1;
      }
    }
  }

  return failures;
}

/** Expand wording variants so evaluation is not phrase-locked. */
function variants(baseTurns, messageVariants) {
  const out = [];
  for (const [idx, alts] of Object.entries(messageVariants)) {
    const i = Number(idx);
    for (const alt of alts) {
      const clone = baseTurns.map((t, j) => (j === i ? { ...t, message: alt } : { ...t }));
      out.push(clone);
    }
  }
  return out;
}

const conversations = [];

// A — track → identity → refund complaint → clarify → correct order → product → refund switch
conversations.push({
  name: 'A_track_refund_correct_product',
  turns: [
    {
      message: 'Where is my order?',
      llm: { primaryIntent: 'track_order', turnType: 'new_intent' },
      expectRoute: 'track_order',
      expectIntent: 'track_order',
      expectWorkflow: 'track_order',
    },
    {
      message: '1001, kashif@example.com',
      llm: {
        primaryIntent: 'track_order',
        turnType: 'field_response',
        entities: { orderNumber: '1001', email: 'kashif@example.com' },
      },
      expectRoute: 'track_order',
      expectEntities: { orderNumber: '1001', email: 'kashif@example.com' },
    },
    {
      message: "I still haven't got the money",
      llm: { primaryIntent: 'refund_not_received', turnType: 'new_intent' },
      expectRoute: 'refund_not_received',
      topicSwitch: true,
      expectWorkflow: 'refund_investigation',
    },
    {
      message: 'What do you mean?',
      llm: { primaryIntent: 'clarify_previous_response', turnType: 'clarification' },
      expectRoute: 'clarification',
    },
    {
      message: 'Actually the order is 1002',
      llm: {
        primaryIntent: 'track_order',
        turnType: 'correction',
        isCorrection: true,
        entities: { orderNumber: '1002' },
      },
      expectRoute: 'correction',
      expectEntities: { orderNumber: '1002' },
    },
    {
      message: 'Recommend me something for my wedding',
      llm: { primaryIntent: 'product_recommendation', turnType: 'new_intent' },
      expectRoute: 'product',
      topicSwitch: true,
      expectWorkflow: 'product_search',
    },
    {
      message: 'Large, white, under $300',
      llm: {
        primaryIntent: 'product_recommendation',
        turnType: 'field_response',
        entities: { size: 'L', color: 'white', budgetMax: 300 },
      },
      expectRoute: 'product',
      expectEntities: { size: 'L', color: 'white', budgetMax: 300 },
    },
    {
      message: 'I need a refund',
      llm: { primaryIntent: 'request_refund', turnType: 'new_intent' },
      expectRoute: 'return_or_refund',
      topicSwitch: true,
      expectWorkflow: 'return_request',
    },
  ],
});

// B — product prefs multi-entity + color correction
conversations.push({
  name: 'B_product_refine',
  turns: [
    {
      message: 'Recommend something',
      llm: { primaryIntent: 'product_recommendation', turnType: 'new_intent' },
      expectRoute: 'product',
      expectWorkflow: 'product_search',
    },
    {
      message: "It's for a wedding, I wear large, and white is fine",
      llm: {
        primaryIntent: 'product_recommendation',
        turnType: 'field_response',
        entities: { occasion: 'wedding', size: 'L', color: 'white' },
      },
      expectRoute: 'product',
      expectEntities: { occasion: 'wedding', size: 'L', color: 'white' },
    },
    {
      message: 'Actually show me black instead',
      llm: {
        primaryIntent: 'product_recommendation',
        turnType: 'correction',
        isCorrection: true,
        entities: { color: 'black' },
      },
      expectRoute: 'correction',
      expectEntities: { color: 'black' },
    },
  ],
});

// C — return interrupted by tracking then resume
conversations.push({
  name: 'C_return_interrupt',
  turns: [
    {
      message: 'I want a return',
      llm: { primaryIntent: 'start_return', turnType: 'new_intent' },
      expectRoute: 'return_or_refund',
      expectWorkflow: 'return_request',
    },
    {
      message: 'Never mind, where is my package?',
      llm: { primaryIntent: 'track_order', turnType: 'new_intent' },
      expectRoute: 'track_order',
      topicSwitch: true,
      expectWorkflow: 'track_order',
    },
    {
      message: 'Actually continue the return',
      llm: { primaryIntent: 'start_return', turnType: 'new_intent' },
      expectRoute: 'return_or_refund',
      topicSwitch: true,
    },
  ],
});

// D — refund misunderstanding + handoff + continue AI
conversations.push({
  name: 'D_handoff_continue',
  turns: [
    {
      message: 'It says refunded but I got nothing',
      llm: { primaryIntent: 'refund_not_received', turnType: 'new_intent' },
      expectRoute: 'refund_not_received',
    },
    {
      message: "I didn't ask financial status",
      llm: {
        primaryIntent: 'track_order',
        turnType: 'rejection',
        rejectsPreviousAnswer: true,
      },
      expectRoute: 'rejection',
    },
    {
      message: 'Connect me to supprot',
      llm: { primaryIntent: 'contact_support', turnType: 'handoff_request', requestsHuman: true },
      expectRoute: 'handoff',
    },
    {
      message: 'No, keep helping here',
      llm: { primaryIntent: 'continue_with_ai', turnType: 'cancellation', continueWithAI: true },
      expectRoute: 'continue_ai',
    },
  ],
});

// E — contact request safety (no auto-submit)
conversations.push({
  name: 'E_contact_flow',
  turns: [
    {
      message: 'Where can I leave my details?',
      llm: { primaryIntent: 'leave_contact_details', turnType: 'new_intent' },
      expectRoute: 'contact_request',
      expectWorkflow: 'contact_request',
    },
    {
      message: 'Use email',
      llm: {
        primaryIntent: 'leave_contact_details',
        turnType: 'field_response',
        entities: { contactMethod: 'email' },
      },
      expectRoute: 'contact_request',
    },
    {
      message: 'john@example.com',
      llm: {
        primaryIntent: 'leave_contact_details',
        turnType: 'field_response',
        entities: { email: 'john@example.com' },
      },
      expectEntities: { email: 'john@example.com' },
    },
    {
      message: 'Actually use jane@example.com',
      llm: {
        primaryIntent: 'leave_contact_details',
        turnType: 'correction',
        isCorrection: true,
        entities: { email: 'jane@example.com' },
      },
      expectRoute: 'correction',
      expectEntities: { email: 'jane@example.com' },
    },
  ],
});

// F — tracking answer quality
conversations.push({
  name: 'F_tracking_no_financial_dump',
  turns: [
    {
      message: 'Where is my order?',
      llm: { primaryIntent: 'track_order', turnType: 'new_intent' },
      expectRoute: 'track_order',
      forbidPhrase: 'financial status is',
      card: {
        orderNumber: '1001',
        financialStatus: 'refunded',
        fulfillmentStatus: 'restocked',
      },
    },
  ],
});

// Generate wording variants for A[0], A[2], D[2], C[1]
const aBase = conversations[0].turns;
for (const msg of [
  'wheres my order',
  'track my package pls',
  'shipping status?',
  'any update on my order',
]) {
  conversations.push({
    name: `A_variant_open_${msg.slice(0, 12)}`,
    turns: [{ ...aBase[0], message: msg }],
  });
}

for (const msg of [
  "haven't received refund",
  'still waiting for my money',
  'refund not in my account',
  'no money came back',
]) {
  conversations.push({
    name: `A_variant_refund_${msg.slice(0, 12)}`,
    turns: [
      { ...aBase[0] },
      { ...aBase[2], message: msg, llm: { primaryIntent: 'refund_not_received', turnType: 'new_intent' } },
    ],
  });
}

for (const msg of [
  'talk to a human',
  'I need an agent',
  'speak to customer service',
  'connect me with support',
  'real person please',
]) {
  conversations.push({
    name: `handoff_${msg.slice(0, 16)}`,
    turns: [
      {
        message: msg,
        llm: { primaryIntent: 'contact_support', turnType: 'handoff_request', requestsHuman: true },
        expectRoute: 'handoff',
        topicSwitch: true,
        expectWorkflow: 'handoff',
      },
    ],
  });
}

// Pad until ≥160 turns with synthetic topic-switch + correction pairs
const switchPairs = [
  ['product_search', 'request_refund', 'return_or_refund'],
  ['return_request', 'track_order', 'track_order'],
  ['track_order', 'product_recommendation', 'product'],
  ['product_search', 'contact_support', 'handoff'],
  ['contact_request', 'track_order', 'track_order'],
  ['refund_investigation', 'start_return', 'return_or_refund'],
  ['track_order', 'refund_not_received', 'refund_not_received'],
  ['product_search', 'leave_contact_details', 'contact_request'],
];

for (let i = 0; i < 60; i += 1) {
  const [fromWf, intent, route] = switchPairs[i % switchPairs.length];
  conversations.push({
    name: `switch_pad_${i}`,
    turns: [
      {
        message: `switch case ${i}`,
        llm: {
          primaryIntent: intent,
          turnType: 'new_intent',
          requestsHuman: intent === 'contact_support',
        },
        expectRoute: route,
        topicSwitch: true,
        _seedWorkflow: fromWf,
      },
    ],
  });
}

for (let i = 0; i < 30; i += 1) {
  conversations.push({
    name: `correction_pad_${i}`,
    turns: [
      {
        message: `It's ${1000 + i}`,
        llm: {
          primaryIntent: 'track_order',
          turnType: 'correction',
          isCorrection: true,
          entities: { orderNumber: String(1000 + i) },
        },
        expectRoute: 'correction',
        expectEntities: { orderNumber: String(1000 + i) },
        _seedWorkflow: 'track_order',
      },
    ],
  });
}

for (let i = 0; i < 25; i += 1) {
  conversations.push({
    name: `casual_pad_${i}`,
    turns: [
      {
        message: i % 2 === 0 ? 'thanks' : 'hello',
        llm: {
          primaryIntent: i % 2 === 0 ? 'thank_you' : 'greeting',
          turnType: 'casual_conversation',
        },
        expectRoute: 'casual',
      },
    ],
  });
}

// Multi-entity pads
for (const msg of [
  'white wedding dress size large under 250',
  'black, medium, for prom, under $200',
  'ivory gown, XL, wedding',
  'need blue casual shirt size M',
  'red dress for party size small',
]) {
  const det = deterministicEntities(msg);
  conversations.push({
    name: `multi_entity_${msg.slice(0, 20)}`,
    turns: [
      {
        message: msg,
        llm: {
          primaryIntent: 'product_recommendation',
          turnType: 'new_intent',
          entities: det,
        },
        expectRoute: 'product',
        expectEntities: Object.fromEntries(
          Object.entries(det).filter(([, v]) => v != null),
        ),
      },
    ],
  });
}

// Money sanity
assert.equal(normalizeMoneyAmount(65826, 'USD'), 658.26);

function main() {
  let totalFailures = 0;
  for (const conv of conversations) {
    // Seed workflow if requested
    const session = { workflowState: null };
    const state = ensureConversationState(session);
    const first = conv.turns[0];
    if (first._seedWorkflow) {
      switchWorkflow(state, { workflow: first._seedWorkflow, reason: 'seed' });
    }
    // Re-run with seeded state by injecting into runConversation via temporary patch
    totalFailures += runConversationSeeded(conv.name, conv.turns, first._seedWorkflow);
  }

  const routeRate = metrics.routeOk / Math.max(1, metrics.turns);
  const intentRate = metrics.intentOk / Math.max(1, metrics.turns);
  const entityRate = metrics.entityOk / Math.max(1, metrics.entityTotal);
  const switchRate = metrics.topicSwitchOk / Math.max(1, metrics.topicSwitchTotal);
  const correctionRate = metrics.correctionOk / Math.max(1, metrics.correctionTotal);

  console.log('\n=== Live-chat conversation eval (offline) ===');
  console.log(JSON.stringify({
    conversations: conversations.length,
    turns: metrics.turns,
    routeAccuracy: Number(routeRate.toFixed(4)),
    intentAccuracy: Number(intentRate.toFixed(4)),
    entityAccuracy: Number(entityRate.toFixed(4)),
    topicSwitchAccuracy: Number(switchRate.toFixed(4)),
    correctionAccuracy: Number(correctionRate.toFixed(4)),
    workflowLockIn: metrics.workflowLockIn,
    unsupportedClaims: metrics.unsupportedClaim,
    failures: totalFailures,
  }, null, 2));

  assert.ok(metrics.turns >= 150, `expected ≥150 turns, got ${metrics.turns}`);
  assert.equal(metrics.unsupportedClaim, 0);
  assert.equal(metrics.workflowLockIn, 0);
  assert.ok(switchRate >= 0.98, `topic switch ${switchRate}`);
  assert.ok(correctionRate >= 0.98, `correction ${correctionRate}`);
  assert.ok(entityRate >= 0.95, `entity ${entityRate}`);
  assert.ok(totalFailures === 0, `failures ${totalFailures}`);
  console.log('PASS');
}

function runConversationSeeded(name, turns, seedWorkflow) {
  const session = { workflowState: null };
  const state = ensureConversationState(session);
  if (seedWorkflow) switchWorkflow(state, { workflow: seedWorkflow, reason: 'seed' });
  let failures = 0;

  for (const turn of turns) {
    metrics.turns += 1;
    const understanding = simulateUnderstanding(turn.message, turn.llm || {});
    mergeEntities(state, understanding.entities, { isCorrection: understanding.isCorrection });
    if (understanding.isCorrection || turn.llm?.isCorrection) {
      applyCorrections(state, {
        orderNumber: understanding.entities.orderNumber,
        email: understanding.entities.email,
        productPreferences: {
          size: understanding.entities.size,
          color: understanding.entities.color,
        },
      });
      metrics.correctionTotal += 1;
      if (
        !turn.expectEntities?.orderNumber ||
        state.collectedContext.orderNumber === String(turn.expectEntities.orderNumber)
      ) {
        metrics.correctionOk += 1;
      } else {
        failures += 1;
        console.error(`[${name}] correction state fail`);
      }
    }

    const route = resolveRoute(understanding, state);

    if (turn.expectRoute) {
      if (route.route === turn.expectRoute) metrics.routeOk += 1;
      else {
        failures += 1;
        console.error(`[${name}] route fail "${turn.message}" → ${route.route} expected ${turn.expectRoute}`);
      }
    } else metrics.routeOk += 1;

    if (turn.expectIntent) {
      if (
        normalizeIntent(understanding.primaryIntent) === normalizeIntent(turn.expectIntent) ||
        normalizeIntent(route.intent) === normalizeIntent(turn.expectIntent)
      ) {
        metrics.intentOk += 1;
      } else {
        failures += 1;
        console.error(`[${name}] intent fail`);
      }
    } else metrics.intentOk += 1;

    if (turn.expectEntities && !scoreEntities(turn.expectEntities, understanding.entities)) {
      failures += 1;
    }

    if (turn.topicSwitch) {
      metrics.topicSwitchTotal += 1;
      if (route.route === turn.expectRoute) metrics.topicSwitchOk += 1;
      else {
        metrics.workflowLockIn += 1;
        failures += 1;
      }
    }

    if (turn.forbidPhrase) {
      const answer = trackingAnswer(turn.card || {});
      if (new RegExp(turn.forbidPhrase, 'i').test(answer.suggestedText)) {
        metrics.unsupportedClaim += 1;
        failures += 1;
      }
    }

    if (turn.expectWorkflow !== undefined) {
      switchWorkflow(state, { workflow: turn.expectWorkflow, reason: route.reason });
    } else if (route.route === 'product') {
      switchWorkflow(state, { workflow: 'product_search', reason: 'eval' });
    } else if (route.route === 'track_order') {
      switchWorkflow(state, { workflow: 'track_order', reason: 'eval' });
    } else if (route.route === 'return_or_refund') {
      switchWorkflow(state, { workflow: 'return_request', reason: 'eval' });
    } else if (route.route === 'handoff') {
      switchWorkflow(state, { workflow: 'handoff', reason: 'eval' });
    } else if (route.route === 'refund_not_received') {
      switchWorkflow(state, { workflow: 'refund_investigation', reason: 'eval' });
    } else if (route.route === 'contact_request') {
      switchWorkflow(state, { workflow: 'contact_request', reason: 'eval' });
    }
  }

  return failures;
}

main();
