/**
 * Response-quality helpers for the config-aware assistant engine.
 * Status ≠ reason. Optional prefs ≠ required. Identity ≠ infrastructure.
 */

const { formatMoney, toNumber } = require('../live-chat-money.service');

const PREFERENCE_DECLINED_RE =
  /\b(i('?m| am)?\s+not\s+sure|i\s+don'?t\s+know|no\s+preference|anything\s+(is\s+)?fine|surprise\s+me|whatever\s+you\s+(recommend|suggest)|just\s+(show|suggest|recommend)|just\s+suggest\s+(me\s+)?products?|show\s+me\s+(something|options|products)|no\s+idea)\b/i;

const SEARCH_NOW_RE =
  /\b(just\s+(show|suggest|recommend)|show\s+(me\s+)?(products?|options|something)|suggest\s+(me\s+)?products?|search\s+now|no\s+more\s+(questions|details)|stop\s+asking)\b/i;

const AI_IDENTITY_RE =
  /\b(what\s+(ai\s+)?model|which\s+model|are\s+you\s+(using\s+)?(openai|chatgpt|gpt|groq|claude|llama|anthropic)|is\s+(this|it)\s+(openai|chatgpt|gpt|groq)|what\s+llm|what\s+api|system\s+prompt|how\s+were\s+you\s+built|what\s+tools?\s+do\s+you\s+have|are\s+you\s+(a\s+)?(bot|ai|chatgpt))\b/i;

const WHY_REASON_RE =
  /\bwhy\b[\s\S]{0,60}\brefund|\bwhy\b[\s\S]{0,60}\bcancel|\bwhy\b[\s\S]{0,60}\brestock|\b(?:know|tell|explain|give)\s+(?:me\s+)?(?:the\s+)?reason\b|\bwhat\s+(?:was\s+)?the\s+reason\b|\bthe\s+reason\b|\breason\b[\s\S]{0,40}\brefund|\breason\b[\s\S]{0,40}\bcancel/i;

const UNSUPPORTED_CAUSAL_RE =
  /\b(because|due\s+to|caused\s+by|the\s+reason\s+is|this\s+happened\s+because|as\s+a\s+result\s+of)\b/i;

const UNHELPFUL_PHRASES = [
  /consider this matter closed/i,
  /this update should reflect/i,
  /i will try to assist/i,
  /i('?ll| will) do my best/i,
  /what are you trying to accomplish/i,
];

/** Internal fulfilment/inventory terms customers should never see. */
const INTERNAL_CUSTOMER_JARGON = [
  /\brestock(?:ed|ing)?\b/i,
  /\breturned to inventory\b/i,
  /\bwent back into inventory\b/i,
  /\bcancelled from fulfilment\b/i,
  /\bcanceled from fulfillment\b/i,
];

function parseBudgetShorthand(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const kMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);

  const grandMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*grand\b/i);
  if (grandMatch) return Math.round(Number(grandMatch[1]) * 1000);

  const underMatch = raw.match(/\bunder\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  if (underMatch) {
    const n = toNumber(underMatch[1]);
    return n == null ? null : Math.round(n);
  }

  // Bare number like "40000" or "40,000" (not cents)
  const bare = raw.match(/^\s*\$?\s*([\d,]+(?:\.\d+)?)\s*$/);
  if (bare) {
    const n = toNumber(bare[1]);
    return n == null ? null : Math.round(n);
  }

  return null;
}

/**
 * Format a customer budget already in major currency units (no cents heuristic).
 */
function formatBudgetMajor(amount, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase();
  const n = toNumber(amount);
  if (n == null) return '';
  const formatted = Math.round(n).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
  return `${code} ${formatted}`;
}

function isProductSearchReady(prefs = {}, { searchNow = false, declined = [] } = {}) {
  if (searchNow) return true;
  const p = prefs || {};
  const hasCore =
    Boolean(p.productQuery) ||
    Boolean(p.category) ||
    Boolean(p.occasion) ||
    Boolean(p.color) ||
    Boolean(p.style) ||
    p.budgetMax != null;

  if (!hasCore) return false;

  // Enough when we have any searchable signal plus size, OR two signals, OR
  // occasion/color/budget alone for fashion catalogues.
  const signals = [p.occasion, p.color, p.size, p.style, p.category, p.productQuery, p.budgetMax]
    .filter((v) => v != null && v !== '')
    .length;

  if (signals >= 2) return true;
  if (p.occasion && (p.size || p.color || p.budgetMax != null)) return true;
  if (p.productQuery && String(p.productQuery).length > 3) return true;
  if (declined.length && hasCore) return true;
  return false;
}

function detectPreferenceDeclined(text) {
  const lower = String(text || '').toLowerCase();
  if (!PREFERENCE_DECLINED_RE.test(lower) && !SEARCH_NOW_RE.test(lower)) {
    return { declined: false, searchNow: false, declinedFields: [] };
  }
  return {
    declined: true,
    searchNow: true,
    declinedFields: ['style', 'material', 'category', 'sleeve', 'eventDate'],
  };
}

function detectAiIdentityQuestion(text) {
  return AI_IDENTITY_RE.test(String(text || ''));
}

function detectWhyReasonQuestion(text) {
  return WHY_REASON_RE.test(String(text || ''));
}

function buildAiIdentityReply({ agentName = 'Support', storeName = 'this store' } = {}) {
  const name = agentName || 'Support';
  return `I'm ${name}, the AI support assistant for ${storeName}. I can help with orders, products, returns, refunds, and store questions.`;
}

function buildAiIdentityFollowUp() {
  return "I'm not able to provide internal technical details, but I can help with products, orders, returns, and support.";
}

/**
 * Normalize order reason fields from tool/order data.
 * Status fields must never be treated as reasons.
 */
function extractOrderReasonFields(orderOrCard = {}) {
  const raw =
    orderOrCard.refundReason ||
    orderOrCard.cancelReason ||
    orderOrCard.cancellationReason ||
    orderOrCard.reason ||
    orderOrCard.reasonDisplay ||
    null;

  const reasonDisplay =
    raw && typeof raw === 'string' && raw.trim() && !/^(refunded|restocked|cancelled|canceled|null|undefined)$/i.test(raw.trim())
      ? raw.trim()
      : null;

  return {
    status: {
      financialStatus: orderOrCard.financialStatus || null,
      fulfillmentStatus: orderOrCard.fulfillmentStatus || null,
    },
    reasonCode: orderOrCard.reasonCode || null,
    reasonDisplay,
    reasonSource: reasonDisplay ? orderOrCard.reasonSource || 'order_field' : null,
    reasonCustomerVisible: Boolean(reasonDisplay && orderOrCard.reasonCustomerVisible !== false),
  };
}

function normalizeOrderNumberDisplay(orderNumber) {
  return String(orderNumber || '')
    .trim()
    .replace(/^#+/, '');
}

function buildRefundReasonUnavailableText(orderNumber, card = {}) {
  const n = normalizeOrderNumberDisplay(orderNumber || card.orderNumber || 'that order');
  return `I can see that order #${n} was refunded, but I don't have the reason noted on this order. I can connect you with support if you'd like them to check.`;
}

function buildTrackingRefundedText(orderNumber, card = {}) {
  const n = normalizeOrderNumberDisplay(orderNumber || card.orderNumber || 'that order');
  return `I've looked up order #${n}. This order was refunded, so there isn't a shipment to track. If you have any questions about the refund, I'm happy to help.`;
}

function buildClarificationRefundedText(orderNumber) {
  const n = normalizeOrderNumberDisplay(orderNumber);
  const label = n ? `#${n}` : 'that order';
  return `Sorry for any confusion. Order ${label} was refunded and won't be shipped. I don't have the reason for the refund on file here. Would you like me to connect you with our team to look into it?`;
}

function hasUnsupportedCausalClaim(text, { verifiedReason = null } = {}) {
  if (!UNSUPPORTED_CAUSAL_RE.test(String(text || ''))) return false;
  if (verifiedReason) return false;
  return true;
}

function hasUnhelpfulPhrase(text) {
  return UNHELPFUL_PHRASES.some((re) => re.test(String(text || '')));
}

function hasInternalCustomerJargon(text) {
  return INTERNAL_CUSTOMER_JARGON.some((re) => re.test(String(text || '')));
}

function validateAssistantClaims(text, plan = {}) {
  const violations = [];
  const verifiedReason =
    plan.verifiedReason ||
    plan.allowedFacts?.verifiedReason ||
    plan.allowedFacts?.reasonDisplay ||
    null;

  if (hasUnsupportedCausalClaim(text, { verifiedReason })) {
    violations.push('UNSUPPORTED_CAUSAL_CLAIM');
  }
  if (hasUnhelpfulPhrase(text)) {
    violations.push('unhelpful_phrase');
  }
  if (hasInternalCustomerJargon(text)) {
    violations.push('internal_jargon');
  }
  // Circular status-as-reason patterns
  if (
    /\breason\b.{0,40}\b(refunded|restocked|cancelled|canceled)\b/i.test(text) ||
    /\b(refunded|restocked)\b.{0,40}\breason\b/i.test(text)
  ) {
    if (!verifiedReason) violations.push('STATUS_AS_REASON');
  }
  if (/[—–]/.test(String(text || '')) || /--/.test(String(text || ''))) {
    violations.push('dash_style');
  }
  return {
    ok: violations.length === 0,
    violations: [...new Set(violations)],
  };
}

function summarizePrefsForCustomer(prefs = {}, currency = 'USD') {
  const bits = [];
  if (prefs.color) bits.push(prefs.color);
  if (prefs.occasion) bits.push(`${prefs.occasion}`);
  if (prefs.size) bits.push(`size ${prefs.size}`);
  if (prefs.budgetMax != null) bits.push(`up to ${formatBudgetMajor(prefs.budgetMax, currency)}`);
  if (prefs.style) bits.push(prefs.style);
  return bits.join(', ');
}

module.exports = {
  parseBudgetShorthand,
  formatBudgetMajor,
  isProductSearchReady,
  detectPreferenceDeclined,
  detectAiIdentityQuestion,
  detectWhyReasonQuestion,
  buildAiIdentityReply,
  buildAiIdentityFollowUp,
  extractOrderReasonFields,
  buildRefundReasonUnavailableText,
  buildTrackingRefundedText,
  buildClarificationRefundedText,
  hasUnsupportedCausalClaim,
  hasUnhelpfulPhrase,
  hasInternalCustomerJargon,
  validateAssistantClaims,
  summarizePrefsForCustomer,
  PREFERENCE_DECLINED_RE,
  SEARCH_NOW_RE,
  AI_IDENTITY_RE,
  WHY_REASON_RE,
};
