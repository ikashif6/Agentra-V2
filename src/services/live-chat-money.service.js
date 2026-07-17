/**
 * Canonical money helpers for live-chat / store surfaces.
 * Never mix minor units and major units in customer-facing copy.
 */

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a store amount into major currency units.
 * Shopify Admin REST usually stores major units as strings ("658.26").
 * Some sync paths incorrectly persist cents as integers (65826 → should be 658.26).
 */
function normalizeMoneyAmount(amount, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase();
  let n = toNumber(amount);
  if (n == null) return null;

  if (!ZERO_DECIMAL.has(code) && Number.isInteger(n) && Math.abs(n) >= 10000) {
    // Treat large integers on decimal currencies as minor units (cents)
    n = n / 100;
  }
  return n;
}

function formatMoney(amount, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase();
  const n = normalizeMoneyAmount(amount, code);
  if (n == null) return '';
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: ZERO_DECIMAL.has(code) ? 0 : 2,
    maximumFractionDigits: ZERO_DECIMAL.has(code) ? 0 : 2,
  });
  return `${code} ${formatted}`;
}

function moneyObject(amount, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase();
  const major = normalizeMoneyAmount(amount, code);
  return {
    amount: major == null ? null : String(major),
    currency: code,
    display: formatMoney(major, code),
  };
}

module.exports = {
  ZERO_DECIMAL,
  toNumber,
  normalizeMoneyAmount,
  formatMoney,
  moneyObject,
};
