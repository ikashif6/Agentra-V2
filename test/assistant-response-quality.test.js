/**
 * Response-quality regressions for v3 assistant engine.
 * Run: node --test test/assistant-response-quality.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseBudgetShorthand,
  formatBudgetMajor,
  isProductSearchReady,
  detectPreferenceDeclined,
  detectAiIdentityQuestion,
  detectWhyReasonQuestion,
  buildAiIdentityReply,
  buildRefundReasonUnavailableText,
  buildTrackingRefundedText,
  buildClarificationRefundedText,
  validateAssistantClaims,
  extractOrderReasonFields,
} = require('../src/services/assistant-engine/assistant-response-quality.service');
const {
  getNextBusinessOpening,
  formatNextOpeningForCustomer,
  isWithinBusinessHours,
  resolveSupportAvailability,
} = require('../src/services/live-chat-hours.service');
const { trackingAnswer, resolveRoute } = require('../src/services/live-chat-conversation.service');
const { mergeDeterministic } = require('../src/services/live-chat-understanding.service');

// mergeDeterministic is not exported - use understand via require internals
const understanding = require('../src/services/live-chat-understanding.service');

function hoursCompany(overrides = {}) {
  return {
    timezone: 'UTC',
    settings: {
      businessHours: {
        enabled: true,
        timezone: 'UTC',
        schedule: {
          monday: { enabled: true, start: '09:00', end: '12:00' },
          tuesday: { enabled: true, start: '09:00', end: '12:00' },
          wednesday: { enabled: true, start: '09:00', end: '12:00' },
          thursday: { enabled: true, start: '09:00', end: '12:00' },
          friday: { enabled: true, start: '09:00', end: '12:00' },
          saturday: { enabled: false, start: '09:00', end: '12:00' },
          sunday: { enabled: false, start: '09:00', end: '12:00' },
        },
      },
    },
    ...overrides,
  };
}

describe('A. refund reason unavailable', () => {
  it('does not invent a reason from refunded/restocked status', () => {
    const card = {
      orderNumber: '1001',
      financialStatus: 'refunded',
      fulfillmentStatus: 'restocked',
    };
    const reason = extractOrderReasonFields(card);
    assert.equal(reason.reasonDisplay, null);
    const text = buildRefundReasonUnavailableText('1001', card);
    assert.match(text, /don't have the reason noted/i);
    assert.equal(/the reason for the refund is that/i.test(text), false);
    assert.equal(/because.{0,40}restocked/i.test(text), false);
    assert.equal(/\brestock/i.test(text), false);
    assert.match(text, /connect you with support/i);
  });

  it('rejects circular causal claims in validator', () => {
    const bad = validateAssistantClaims(
      'The reason for the refund is that the item was refunded and restocked.',
      { verifiedReason: null },
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.violations.includes('UNSUPPORTED_CAUSAL_CLAIM') || bad.violations.includes('STATUS_AS_REASON'));
  });

  it('tracking answer does not use because for refunded orders', () => {
    const answer = trackingAnswer({
      orderNumber: '1001',
      financialStatus: 'refunded',
      fulfillmentStatus: 'restocked',
    });
    assert.equal(/because/i.test(answer.suggestedText), false);
    assert.equal(/matter closed/i.test(answer.suggestedText), false);
    assert.equal(/\brestock/i.test(answer.suggestedText), false);
    assert.match(answer.suggestedText, /refunded/i);
    assert.match(answer.suggestedText, /shipment to track/i);
  });
});

describe('B/C. repeated reason and clarification', () => {
  it('detects why/reason questions', () => {
    assert.equal(detectWhyReasonQuestion('why was it refunded'), true);
    assert.equal(detectWhyReasonQuestion('I want to know the reason'), true);
    assert.equal(detectWhyReasonQuestion('where is my order'), false);
  });

  it('clarifies refunded orders without internal jargon or invented cause', () => {
    const text = buildClarificationRefundedText('1001');
    assert.match(text, /refunded/i);
    assert.equal(/because it was restocked/i.test(text), false);
    assert.equal(/\brestock|inventory|fulfilment|fulfillment\b/i.test(text), false);
    assert.match(text, /connect you with our team/i);
  });
});

describe('D. product preference readiness', () => {
  it('is ready with wedding + L + white + budget', () => {
    assert.equal(
      isProductSearchReady({
        occasion: 'wedding',
        size: 'L',
        color: 'white',
        budgetMax: 40000,
      }),
      true,
    );
  });

  it('treats I am not sure as search-now', () => {
    const d = detectPreferenceDeclined("I am not sure, just suggest me products");
    assert.equal(d.searchNow, true);
    assert.ok(d.declinedFields.includes('style'));
  });

  it('understanding marks show_results_now for just suggest products', () => {
    // Use exported understand helpers via deterministic merge path
    const { understandCustomerMessage } = understanding;
    // sync path without groq: deterministicEntities + merge via empty llm
    const mod = require('../src/services/live-chat-understanding.service');
    // Call through public API with AI disabled
    const prev = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    return understandCustomerMessage('I am not sure, just suggest me products', {
      activeWorkflow: 'product_search',
      collectedContext: {
        productPreferences: {
          occasion: 'wedding',
          size: 'L',
          color: 'white',
          budgetMax: 40000,
        },
      },
    }).then((u) => {
      assert.equal(u.searchNow, true);
      assert.ok(
        u.turnType === 'show_results_now' ||
          u.turnType === 'preference_declined' ||
          u.primaryIntent === 'product_recommendation',
      );
      if (prev !== undefined) process.env.GROQ_API_KEY = prev;
    });
  });

  it('parses 40k budget shorthand as major units', () => {
    assert.equal(parseBudgetShorthand('40k'), 40000);
    assert.equal(parseBudgetShorthand('1.5k'), 1500);
    assert.equal(formatBudgetMajor(40000, 'PKR'), 'PKR 40,000');
    assert.equal(formatBudgetMajor(40000, 'USD'), 'USD 40,000');
  });
});

describe('E. business hours next opening', () => {
  it('allows handoff outside business hours when an agent is online', () => {
    const availability = resolveSupportAvailability({
      liveSupportEnabled: true,
      withinHours: false,
      onlineAgentCount: 1,
    });
    assert.equal(availability.queueOpen, true);
    assert.equal(availability.availableAgentCount, 1);
    assert.equal(availability.reason, 'available');
  });

  it('uses the next opening only when outside hours and no agent is online', () => {
    const availability = resolveSupportAvailability({
      liveSupportEnabled: true,
      withinHours: false,
      onlineAgentCount: 0,
    });
    assert.equal(availability.queueOpen, false);
    assert.equal(availability.reason, 'outside_business_hours');
  });

  it('never returns today 9:00 AM after that time has passed', () => {
    const company = hoursCompany();
    // Thursday 12:29 UTC — hours ended at 12:00
    const at = new Date('2026-07-16T12:29:00Z');
    assert.equal(isWithinBusinessHours(company, at), false);
    const next = getNextBusinessOpening(company, at);
    assert.ok(next);
    assert.ok(next.startsAt.getTime() > at.getTime());
    assert.equal(next.displayText.includes('today at 9:00'), false);
  });

  it('returns today at 9:00 only when still in the future', () => {
    const company = hoursCompany();
    const at = new Date('2026-07-16T07:00:00Z'); // Thursday before open
    const next = getNextBusinessOpening(company, at);
    assert.ok(next);
    assert.match(next.displayText, /today at 9:00/i);
    assert.ok(next.startsAt.getTime() > at.getTime());
  });

  it('formatNextOpeningForCustomer stays future-only', () => {
    const company = hoursCompany();
    const at = new Date('2026-07-16T12:29:00Z');
    const text = formatNextOpeningForCustomer(company, at);
    assert.ok(text);
    assert.equal(/today at 9:00/i.test(text), false);
  });
});

describe('F. AI identity', () => {
  it('detects model/provider questions', () => {
    assert.equal(detectAiIdentityQuestion('What AI model are you using? Is it OpenAI?'), true);
    assert.equal(detectAiIdentityQuestion('where is my order'), false);
  });

  it('replies with store assistant identity only', () => {
    const text = buildAiIdentityReply({
      agentName: 'Vastora AI',
      storeName: 'Vastora Bridal',
    });
    assert.match(text, /Vastora/i);
    assert.equal(/OpenAI|Groq|Llama|ChatGPT/i.test(text), false);
    assert.match(text, /orders|products|returns/i);
  });

  it('routes ai identity questions', () => {
    const route = resolveRoute(
      {
        primaryIntent: 'ai_identity_question',
        turnType: 'ai_identity_question',
        requestsHuman: false,
        continueWithAI: false,
        isCorrection: false,
        rejectsPreviousAnswer: false,
      },
      { activeWorkflow: null },
    );
    assert.equal(route.route, 'ai_identity');
  });
});

describe('G. unhelpful wording', () => {
  it('flags consider this matter closed', () => {
    const v = validateAssistantClaims('You can consider this matter closed for this order.');
    assert.equal(v.ok, false);
    assert.ok(v.violations.includes('unhelpful_phrase'));
  });

  it('tracking refunded copy avoids closed language and internal jargon', () => {
    const text = buildTrackingRefundedText('1001', {
      financialStatus: 'refunded',
      fulfillmentStatus: 'restocked',
    });
    assert.equal(/matter closed|try to assist|do my best/i.test(text), false);
    assert.equal(/\brestock|inventory\b/i.test(text), false);
  });

  it('flags internal jargon like restocked in customer text', () => {
    const v = validateAssistantClaims('Your item was restocked in our warehouse.');
    assert.equal(v.ok, false);
    assert.ok(v.violations.includes('internal_jargon'));
  });
});
