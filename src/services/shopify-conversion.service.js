const { SHOPIFY_API_VERSION } = require('./store.service');

const CONVERSION_QUERY = `
  query OrderConversion($id: ID!) {
    order(id: $id) {
      name
      customerJourneySummary {
        customerOrderIndex
        daysToConversion
        ready
        momentsCount
        firstVisit {
          id
          landingPage
          referrerUrl
          source
          sourceDescription
          sourceType
          occurredAt
          utmParameters {
            campaign
            content
            medium
            source
            term
          }
        }
        lastVisit {
          id
          landingPage
          referrerUrl
          source
          sourceDescription
          sourceType
          occurredAt
          utmParameters {
            campaign
            content
            medium
            source
            term
          }
        }
      }
      customerJourney {
        moments(first: 25) {
          edges {
            node {
              ... on CustomerVisit {
                id
                occurredAt
                landingPage
                referrerUrl
                source
                sourceDescription
                sourceType
                utmParameters {
                  campaign
                  content
                  medium
                  source
                  term
                }
              }
            }
          }
        }
      }
      customer {
        numberOfOrders
      }
    }
  }
`;

function ordinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return `${n}`;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return `${num}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

function formatSessionSource(visit) {
  if (!visit) return 'Store visit was direct';
  if (visit.sourceDescription) return visit.sourceDescription;
  if (visit.source) return visit.source;
  if (visit.referrerUrl) return `Referred from ${visit.referrerUrl}`;
  if (visit.sourceType === 'direct') return '1st session was direct to your store';
  return 'Store visit was direct';
}

function formatFirstSessionLine(visit) {
  if (!visit) return '1st session was direct to your store';
  if (visit.sourceDescription) return visit.sourceDescription;
  if (visit.sourceType === 'direct' || !visit.referrerUrl) {
    return '1st session was direct to your store';
  }
  return visit.sourceDescription || `1st session from ${visit.source || visit.referrerUrl}`;
}

function normalizeVisit(node) {
  if (!node) return null;
  return {
    id: node.id,
    occurredAt: node.occurredAt,
    landingPage: node.landingPage || null,
    referrerUrl: node.referrerUrl || null,
    source: node.source || null,
    sourceDescription: node.sourceDescription || null,
    sourceType: node.sourceType || null,
    utmParameters: node.utmParameters || null,
    visitLabel: formatSessionSource(node),
    firstPageLabel: node.landingPage
      ? `The first page they visited was ${node.landingPage}`
      : null,
  };
}

function buildFromGraphql(orderNode) {
  const summary = orderNode?.customerJourneySummary;
  const customerOrderIndex =
    summary?.customerOrderIndex ?? orderNode?.customer?.numberOfOrders ?? null;
  const daysToConversion = summary?.daysToConversion ?? null;
  const momentsCount =
    typeof summary?.momentsCount === 'number'
      ? summary.momentsCount
      : summary?.momentsCount?.count ?? null;

  const momentEdges = orderNode?.customerJourney?.moments?.edges || [];
  const sessions = momentEdges
    .map((edge) => normalizeVisit(edge?.node))
    .filter(Boolean);

  const firstVisit = normalizeVisit(summary?.firstVisit) || sessions[0] || null;
  const lastVisit = normalizeVisit(summary?.lastVisit) || sessions[sessions.length - 1] || null;

  const totalSessions = momentsCount ?? sessions.length ?? (firstVisit ? 1 : 0);
  const days = daysToConversion ?? 1;

  const highlights = [];
  if (customerOrderIndex != null) {
    highlights.push({
      id: 'order-index',
      icon: 'order',
      text: `This is their ${ordinal(customerOrderIndex)} order`,
    });
  }
  if (firstVisit) {
    highlights.push({
      id: 'first-session',
      icon: 'session',
      text: formatFirstSessionLine(summary?.firstVisit || sessions[0]),
    });
  }
  if (totalSessions > 0) {
    highlights.push({
      id: 'sessions-over-days',
      icon: 'chart',
      text: `${totalSessions} session${totalSessions === 1 ? '' : 's'} over ${days} day${days === 1 ? '' : 's'}`,
    });
  }

  const baseSessions =
    sessions.length > 0
      ? sessions
      : [firstVisit, lastVisit].filter(Boolean).filter((session, index, list) => {
          const key = session.id || `${session.occurredAt}-${session.landingPage}`;
          return list.findIndex((item) => (item.id || `${item.occurredAt}-${item.landingPage}`) === key) === index;
        });

  const sessionRows = baseSessions.map((session, index) => ({
    ...session,
    rowLabel:
      index === 0
        ? formatFirstSessionLine(session)
        : session.sourceDescription || session.visitLabel,
  }));

  return {
    ready: summary?.ready !== false,
    customerOrderIndex,
    daysToConversion: days,
    totalSessions,
    highlights,
    sessions: sessionRows,
    firstVisit,
    lastVisit,
  };
}

function buildFromRestOrder(rawOrder) {
  const customerOrders = rawOrder?.customer?.orders_count ?? null;
  const referringSite = rawOrder?.referring_site || null;
  const landingSite = rawOrder?.landing_site || null;
  const placedAt = rawOrder?.created_at || null;

  const firstVisit = {
    id: `rest-${rawOrder?.id}`,
    occurredAt: placedAt,
    landingPage: landingSite,
    referrerUrl: referringSite,
    source: rawOrder?.source_name || null,
    sourceDescription: referringSite
      ? `1st session from ${referringSite}`
      : '1st session was direct to your store',
    sourceType: referringSite ? 'referral' : 'direct',
    utmParameters: null,
    visitLabel: referringSite ? `Referred from ${referringSite}` : 'Store visit was direct',
    firstPageLabel: landingSite
      ? `The first page they visited was ${landingSite}`
      : null,
  };

  const highlights = [];
  if (customerOrders != null) {
    highlights.push({
      id: 'order-index',
      icon: 'order',
      text: `This is their ${ordinal(customerOrders)} order`,
    });
  }
  highlights.push({
    id: 'first-session',
    icon: 'session',
    text: firstVisit.sourceDescription,
  });
  highlights.push({
    id: 'sessions-over-days',
    icon: 'chart',
    text: '1 session over 1 day',
  });

  return {
    ready: true,
    customerOrderIndex: customerOrders,
    daysToConversion: 1,
    totalSessions: 1,
    highlights,
    sessions: [{ ...firstVisit, rowLabel: firstVisit.sourceDescription }],
    firstVisit,
    lastVisit: firstVisit,
    fallback: true,
  };
}

async function shopifyGraphql(shopDomain, accessToken, query, variables) {
  const res = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.errors?.[0]?.message || `Shopify GraphQL failed (${res.status})`);
  }
  if (body.errors?.length) {
    throw new Error(body.errors[0].message || 'Shopify GraphQL error');
  }
  return body.data;
}

async function fetchShopifyConversion(shopDomain, accessToken, externalId, rawOrder) {
  const gid = `gid://shopify/Order/${externalId}`;
  try {
    const data = await shopifyGraphql(shopDomain, accessToken, CONVERSION_QUERY, { id: gid });
    if (!data?.order) throw new Error('Order not found in Shopify');
    const conversion = buildFromGraphql(data.order);
    if (conversion.highlights.length > 0) return conversion;
  } catch (err) {
    console.warn('[shopify conversion]', err.message);
  }
  return buildFromRestOrder(rawOrder);
}

module.exports = {
  fetchShopifyConversion,
  buildFromGraphql,
  buildFromRestOrder,
  shopifyGraphql,
};
