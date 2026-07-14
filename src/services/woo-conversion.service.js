function metaValue(metaData, key) {
  const entry = (metaData || []).find((item) => item?.key === key);
  if (!entry) return null;
  const value = entry.value;
  return value === '' || value == null ? null : String(value);
}

function buildSessionFromWooMeta(metaData, placedAt) {
  const sourceType = metaValue(metaData, '_wc_order_attribution_source_type');
  const utmSource = metaValue(metaData, '_wc_order_attribution_utm_source');
  const utmMedium = metaValue(metaData, '_wc_order_attribution_utm_medium');
  const utmCampaign = metaValue(metaData, '_wc_order_attribution_utm_campaign');
  const utmContent = metaValue(metaData, '_wc_order_attribution_utm_content');
  const utmTerm = metaValue(metaData, '_wc_order_attribution_utm_term');
  const referrer =
    metaValue(metaData, '_wc_order_attribution_referrer') ||
    metaValue(metaData, '_wca_referrer') ||
    null;
  const landingPage =
    metaValue(metaData, '_wc_order_attribution_session_entry') ||
    metaValue(metaData, '_wca_landing_page') ||
    null;
  const deviceType = metaValue(metaData, '_wc_order_attribution_device_type');

  if (!sourceType && !utmSource && !referrer && !landingPage) return null;

  const sourceDescription = [
    sourceType ? sourceType.replace(/_/g, ' ') : null,
    utmSource ? `via ${utmSource}` : null,
    deviceType ? `on ${deviceType}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: 'woo-attribution',
    occurredAt: placedAt || undefined,
    landingPage,
    referrerUrl: referrer,
    source: utmSource || sourceType || null,
    sourceDescription: sourceDescription || undefined,
    sourceType: sourceType || (utmSource ? 'utm' : referrer ? 'referral' : 'direct'),
    utmParameters:
      utmSource || utmMedium || utmCampaign || utmContent || utmTerm
        ? {
            source: utmSource,
            medium: utmMedium,
            campaign: utmCampaign,
            content: utmContent,
            term: utmTerm,
          }
        : null,
    visitLabel: sourceDescription || referrer || landingPage || 'WooCommerce order attribution',
    firstPageLabel: landingPage ? `The first page they visited was ${landingPage}` : null,
    rowLabel: sourceDescription || referrer || 'Order attribution',
  };
}

function fetchWooConversion(rawOrder) {
  const metaData = rawOrder?.meta_data || [];
  const session = buildSessionFromWooMeta(metaData, rawOrder?.date_created);
  if (!session) return null;

  const customerOrderIndex = Number(rawOrder?.customer_order_count || rawOrder?.customer_id) || null;

  const highlights = [];
  if (customerOrderIndex) {
    highlights.push({
      id: 'woo-order-index',
      icon: 'order',
      text: `Customer #${customerOrderIndex}`,
    });
  }
  highlights.push({
    id: 'woo-source',
    icon: 'session',
    text: session.visitLabel,
  });
  if (session.landingPage) {
    highlights.push({
      id: 'woo-landing',
      icon: 'chart',
      text: `Landing page: ${session.landingPage}`,
    });
  }

  return {
    ready: true,
    customerOrderIndex,
    daysToConversion: 1,
    totalSessions: 1,
    highlights,
    sessions: [session],
    firstVisit: session,
    lastVisit: session,
    fallback: true,
  };
}

module.exports = {
  fetchWooConversion,
};
