const DEFAULT_CUSTOM_ACTIONS = [
  'cancel',
  'fulfill',
  'refund',
  'hold',
  'request_fulfillment',
  'send_invoice',
  'resend_order_email',
  'mark_paid',
  'archive',
  'duplicate',
  'remove_customer',
];

const DEFAULT_CUSTOM_FEATURES = {
  conversion: true,
  edit: true,
};

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function customHeaders(apiKey) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function fetchCustomCapabilities({ storeUrl, apiKey }) {
  const base = storeUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/agentra/capabilities`, {
      headers: customHeaders(apiKey),
    });
    if (!res.ok) {
      return { actions: DEFAULT_CUSTOM_ACTIONS, features: DEFAULT_CUSTOM_FEATURES };
    }
    const body = await readJsonResponse(res);
    return {
      actions: Array.isArray(body?.actions) ? body.actions : DEFAULT_CUSTOM_ACTIONS,
      features: {
        conversion: body?.features?.conversion !== false,
        edit: body?.features?.edit !== false,
      },
    };
  } catch {
    return { actions: DEFAULT_CUSTOM_ACTIONS, features: DEFAULT_CUSTOM_FEATURES };
  }
}

function buildSessionFromAttribution(attribution = {}, placedAt) {
  if (!attribution || typeof attribution !== 'object') return null;
  const landingPage = attribution.landingPage || attribution.landingUrl || null;
  const referrerUrl = attribution.referrerUrl || attribution.referrer || null;
  const source = attribution.source || attribution.utmSource || null;
  const sourceDescription =
    attribution.sourceDescription ||
    attribution.label ||
    [source, attribution.medium].filter(Boolean).join(' · ') ||
    null;

  if (!landingPage && !referrerUrl && !source && !sourceDescription) return null;

  return {
    id: attribution.id || 'custom-attribution',
    occurredAt: attribution.occurredAt || placedAt || undefined,
    landingPage,
    referrerUrl,
    source,
    sourceDescription: sourceDescription || undefined,
    sourceType: attribution.sourceType || null,
    utmParameters: attribution.utmParameters || attribution.utm || null,
    visitLabel: sourceDescription || source || referrerUrl || landingPage || 'Store visit',
    firstPageLabel: landingPage ? `The first page they visited was ${landingPage}` : null,
    rowLabel: sourceDescription || source || 'Store visit',
  };
}

function buildCustomConversion(rawOrder) {
  if (rawOrder?.conversion && typeof rawOrder.conversion === 'object') {
    return rawOrder.conversion;
  }

  const attribution = rawOrder?.attribution || rawOrder?.marketingAttribution || null;
  const sessionsInput = Array.isArray(rawOrder?.sessions) ? rawOrder.sessions : [];
  const placedAt = rawOrder?.placedAt || rawOrder?.createdAt || null;

  const sessions = sessionsInput.length
    ? sessionsInput.map((session, index) => ({
        id: session.id || `session-${index}`,
        occurredAt: session.occurredAt || session.at || placedAt,
        landingPage: session.landingPage || null,
        referrerUrl: session.referrerUrl || session.referrer || null,
        source: session.source || null,
        sourceDescription: session.sourceDescription || session.label || null,
        sourceType: session.sourceType || null,
        utmParameters: session.utmParameters || session.utm || null,
        visitLabel: session.sourceDescription || session.source || session.referrerUrl || 'Store visit',
        firstPageLabel: session.landingPage
          ? `The first page they visited was ${session.landingPage}`
          : null,
        rowLabel: session.sourceDescription || session.source || `Session ${index + 1}`,
      }))
    : [buildSessionFromAttribution(attribution, placedAt)].filter(Boolean);

  if (!sessions.length) return null;

  const customerOrderIndex =
    rawOrder?.customerOrderIndex ??
    rawOrder?.customer?.orderCount ??
    rawOrder?.customer?.ordersCount ??
    null;
  const daysToConversion = rawOrder?.daysToConversion ?? 1;
  const totalSessions = rawOrder?.totalSessions ?? sessions.length;

  const highlights = [];
  if (customerOrderIndex != null) {
    highlights.push({
      id: 'custom-order-index',
      icon: 'order',
      text: `This is their ${customerOrderIndex}${customerOrderIndex === 1 ? 'st' : customerOrderIndex === 2 ? 'nd' : customerOrderIndex === 3 ? 'rd' : 'th'} order`,
    });
  }
  highlights.push({
    id: 'custom-first-session',
    icon: 'session',
    text: sessions[0].rowLabel || sessions[0].visitLabel,
  });
  if (totalSessions > 0) {
    highlights.push({
      id: 'custom-sessions',
      icon: 'chart',
      text: `${totalSessions} session${totalSessions === 1 ? '' : 's'} over ${daysToConversion} day${daysToConversion === 1 ? '' : 's'}`,
    });
  }

  return {
    ready: true,
    customerOrderIndex,
    daysToConversion,
    totalSessions,
    highlights,
    sessions,
    firstVisit: sessions[0],
    lastVisit: sessions[sessions.length - 1],
  };
}

module.exports = {
  DEFAULT_CUSTOM_ACTIONS,
  DEFAULT_CUSTOM_FEATURES,
  fetchCustomCapabilities,
  buildCustomConversion,
};
