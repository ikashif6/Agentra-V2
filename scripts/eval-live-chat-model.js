#!/usr/bin/env node
/**
 * Optional live Groq understanding evaluation (synthetic only).
 * Never uses production customer data. Mocks no ecommerce tools — scores structured understanding only.
 *
 * Run: npm run eval:live-chat:model
 * Skips gracefully if GROQ_API_KEY is missing.
 */

require('dotenv').config();

const {
  understandCustomerMessage,
  normalizeIntent,
} = require('../src/services/live-chat-understanding.service');
const { isGroqConfigured } = require('../src/services/groq.service');

const CASES = [
  {
    id: 'track',
    message: 'Where is my order?',
    context: { activeWorkflow: null, recentTurns: [] },
    expect: { primaryIntent: 'track_order', turnType: 'new_intent' },
  },
  {
    id: 'refund_missing',
    message: "I still haven't got the money",
    context: {
      activeWorkflow: 'track_order',
      recentTurns: [
        { role: 'user', body: 'Where is my order?' },
        { role: 'assistant', body: 'Order #1001 will not ship because it was refunded.' },
      ],
      lastAssistantMessage: 'Order #1001 will not ship because it was refunded.',
    },
    expect: { primaryIntent: 'refund_not_received' },
  },
  {
    id: 'rejection',
    message: "I didn't ask financial status",
    context: {
      activeWorkflow: 'track_order',
      lastResponsePlan: { responseType: 'order_card_full' },
      lastAssistantMessage: 'Financial status is refunded.',
    },
    expect: { turnType: 'rejection', rejectsPreviousAnswer: true },
  },
  {
    id: 'correction_order',
    message: "It's 1002",
    context: {
      activeWorkflow: 'track_order',
      collectedContext: { orderNumber: '1001', email: 'a@b.com' },
      recentTurns: [{ role: 'user', body: '1001, a@b.com' }],
    },
    expect: { turnType: 'correction', entities: { orderNumber: '1002' } },
  },
  {
    id: 'multi_prefs',
    message: "It's for a wedding, I wear large, and white is fine",
    context: { activeWorkflow: 'product_search', expectedFields: ['occasion', 'size', 'color'] },
    expect: {
      entities: { occasion: 'wedding', size: 'L', color: 'white' },
    },
  },
  {
    id: 'topic_switch_refund',
    message: 'I need a refund',
    context: {
      activeWorkflow: 'product_search',
      expectedFields: ['occasion', 'size', 'color', 'budget'],
    },
    expect: { primaryIntent: 'request_refund', turnType: 'new_intent' },
  },
  {
    id: 'handoff_typo',
    message: 'Connect me to supprot',
    context: { activeWorkflow: 'track_order' },
    expect: { primaryIntent: 'contact_support', requestsHuman: true },
  },
  {
    id: 'clarify',
    message: 'What do you mean?',
    context: {
      lastAssistantMessage: 'The store marked the order as refunded.',
      lastResponsePlan: { responseType: 'refund_not_received' },
    },
    expect: { turnType: 'clarification' },
  },
];

async function main() {
  if (!isGroqConfigured()) {
    console.log('SKIP: GROQ_API_KEY not configured');
    process.exit(0);
  }

  const model =
    process.env.GROQ_UNDERSTANDING_MODEL ||
    process.env.GROQ_MODEL ||
    'llama-3.3-70b-versatile';
  console.log(`Live understanding eval model=${model} cases=${CASES.length}`);

  let fail = 0;
  for (const c of CASES) {
    const result = await understandCustomerMessage(c.message, c.context);
    const problems = [];
    if (c.expect.primaryIntent && normalizeIntent(result.primaryIntent) !== normalizeIntent(c.expect.primaryIntent)) {
      problems.push(`intent ${result.primaryIntent}≠${c.expect.primaryIntent}`);
    }
    if (c.expect.turnType && result.turnType !== c.expect.turnType) {
      problems.push(`turnType ${result.turnType}≠${c.expect.turnType}`);
    }
    if (c.expect.rejectsPreviousAnswer != null && result.rejectsPreviousAnswer !== c.expect.rejectsPreviousAnswer) {
      problems.push('rejectsPreviousAnswer mismatch');
    }
    if (c.expect.requestsHuman != null && result.requestsHuman !== c.expect.requestsHuman) {
      problems.push('requestsHuman mismatch');
    }
    if (c.expect.entities) {
      for (const [k, v] of Object.entries(c.expect.entities)) {
        if (String(result.entities?.[k] ?? '').toLowerCase() !== String(v).toLowerCase()) {
          problems.push(`entity ${k}=${result.entities?.[k]}≠${v}`);
        }
      }
    }
    if (problems.length) {
      fail += 1;
      console.error(`FAIL ${c.id}:`, problems.join('; '), JSON.stringify({
        primaryIntent: result.primaryIntent,
        turnType: result.turnType,
        entities: result.entities,
        source: result.source,
      }));
    } else {
      console.log(`PASS ${c.id} (confidence=${result.confidence} source=${result.source})`);
    }
  }

  console.log(JSON.stringify({ model, promptVersion: 'understanding-v2-2026-07-16', fail, total: CASES.length }));
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
