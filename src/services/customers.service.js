const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const StoreOrder = require('../models/StoreOrder');
const User = require('../models/User');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveTicketEmail(ticket) {
  const detailsEmail = normalizeEmail(ticket.details?.customerEmail);
  if (detailsEmail) return detailsEmail;
  const fromAddress = normalizeEmail(ticket.email?.fromAddress);
  if (fromAddress) return fromAddress;

  const people = Array.isArray(ticket.peoples) ? ticket.peoples : [];
  for (const entry of people) {
    if (entry?.role !== 'customer') continue;
    const user = entry.user;
    if (user && typeof user === 'object' && user.email) {
      return normalizeEmail(user.email);
    }
  }

  const creator = ticket.createdBy;
  if (creator && typeof creator === 'object' && creator.email && creator.role === 'customer') {
    return normalizeEmail(creator.email);
  }

  return '';
}

function displayNameFromParts(name, firstName, lastName, email) {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  if (name && String(name).trim()) return String(name).trim();
  if (email) return String(email).split('@')[0];
  return 'Unknown';
}

function emptyPurchases() {
  return {
    orderCount: 0,
    totalSpend: 0,
    currency: null,
    lastOrderAt: null,
    lastOrderNumber: null,
    products: [],
  };
}

/**
 * Aggregate customers for a company from tickets + store orders (keyed by email).
 */
async function listCustomers(companyId, { search = '', page = 1, limit = 20 } = {}) {
  const companyObjectId =
    companyId instanceof mongoose.Types.ObjectId
      ? companyId
      : new mongoose.Types.ObjectId(String(companyId));

  const [tickets, orders] = await Promise.all([
    Ticket.find({ company: companyObjectId })
      .select(
        'source status lastActivity createdAt details email peoples createdBy ticket_code ticket_title',
      )
      .populate('createdBy', 'firstName lastName email role')
      .populate('peoples.user', 'firstName lastName email role')
      .sort({ lastActivity: -1, createdAt: -1 })
      .limit(8000)
      .lean(),
    StoreOrder.find({
      company: companyObjectId,
      'customer.email': { $exists: true, $nin: [null, ''] },
    })
      .select('customer orderNumber totalPrice currency placedAt lineItems')
      .sort({ placedAt: -1 })
      .limit(12000)
      .lean(),
  ]);

  /** @type {Map<string, any>} */
  const byEmail = new Map();

  const ensure = (email) => {
    const key = normalizeEmail(email);
    if (!key) return null;
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        email: key,
        name: null,
        phone: null,
        lastContactedAt: null,
        channels: new Set(),
        ticketCount: 0,
        openTicketCount: 0,
        recentTickets: [],
        purchases: emptyPurchases(),
        userId: null,
      });
    }
    return byEmail.get(key);
  };

  for (const ticket of tickets) {
    const email = resolveTicketEmail(ticket);
    if (!email) continue;
    const row = ensure(email);
    if (!row) continue;

    row.ticketCount += 1;
    if (['open', 'in_progress', 'on_hold'].includes(ticket.status)) {
      row.openTicketCount += 1;
    }
    if (ticket.source) row.channels.add(ticket.source);

    const contactedAt = ticket.lastActivity || ticket.createdAt || null;
    if (
      contactedAt &&
      (!row.lastContactedAt || new Date(contactedAt) > new Date(row.lastContactedAt))
    ) {
      row.lastContactedAt = contactedAt;
    }

    if (!row.phone && ticket.details?.customerPhone) {
      row.phone = String(ticket.details.customerPhone).trim();
    }

    const customerPerson = (ticket.peoples || []).find((p) => p.role === 'customer' && p.user);
    const personUser = customerPerson?.user;
    if (personUser && typeof personUser === 'object') {
      if (!row.name) {
        row.name = displayNameFromParts(null, personUser.firstName, personUser.lastName, email);
      }
      if (!row.userId && personUser._id) row.userId = String(personUser._id);
    }

    if (!row.name && ticket.createdBy && typeof ticket.createdBy === 'object') {
      row.name = displayNameFromParts(
        null,
        ticket.createdBy.firstName,
        ticket.createdBy.lastName,
        email,
      );
    }

    if (row.recentTickets.length < 5) {
      row.recentTickets.push({
        ticketCode: ticket.ticket_code,
        title: ticket.ticket_title,
        status: ticket.status,
        source: ticket.source,
        at: contactedAt,
      });
    }
  }

  for (const order of orders) {
    const email = normalizeEmail(order.customer?.email);
    if (!email) continue;
    const row = ensure(email);
    if (!row) continue;

    if (!row.name && order.customer?.name) {
      row.name = String(order.customer.name).trim();
    }
    if (!row.phone && order.customer?.phone) {
      row.phone = String(order.customer.phone).trim();
    }

    const purchases = row.purchases;
    purchases.orderCount += 1;
    purchases.totalSpend += Number(order.totalPrice) || 0;
    if (!purchases.currency && order.currency) purchases.currency = order.currency;

    const placedAt = order.placedAt || null;
    if (
      placedAt &&
      (!purchases.lastOrderAt || new Date(placedAt) > new Date(purchases.lastOrderAt))
    ) {
      purchases.lastOrderAt = placedAt;
      purchases.lastOrderNumber = order.orderNumber || order.name || null;
    }

    for (const item of order.lineItems || []) {
      if (item?.title && purchases.products.length < 8 && !purchases.products.includes(item.title)) {
        purchases.products.push(item.title);
      }
    }
  }

  // Fill names from User records when still missing
  const emailsNeedingName = [...byEmail.values()]
    .filter((row) => !row.name)
    .map((row) => row.email)
    .slice(0, 500);

  if (emailsNeedingName.length) {
    const users = await User.find({
      company: companyObjectId,
      email: { $in: emailsNeedingName },
    })
      .select('_id firstName lastName email')
      .lean();

    for (const user of users) {
      const row = byEmail.get(normalizeEmail(user.email));
      if (!row) continue;
      if (!row.name) {
        row.name = displayNameFromParts(null, user.firstName, user.lastName, user.email);
      }
      if (!row.userId) row.userId = String(user._id);
    }
  }

  const needle = String(search || '').trim().toLowerCase();
  let rows = [...byEmail.values()].map((row) => {
    const purchases = {
      ...row.purchases,
      totalSpend: Math.round((row.purchases.totalSpend || 0) * 100) / 100,
      currency: row.purchases.currency || 'USD',
    };
    return {
      email: row.email,
      name: row.name || displayNameFromParts(null, null, null, row.email),
      phone: row.phone || null,
      lastContactedAt: row.lastContactedAt,
      channels: [...row.channels],
      ticketCount: row.ticketCount,
      openTicketCount: row.openTicketCount,
      recentTickets: row.recentTickets,
      purchases,
      userId: row.userId,
    };
  });

  if (needle) {
    rows = rows.filter((row) => {
      const hay = [
        row.email,
        row.name,
        row.phone,
        ...(row.purchases.products || []),
        row.purchases.lastOrderNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  rows.sort((a, b) => {
    const aTime = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
    const bTime = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return String(a.email).localeCompare(String(b.email));
  });

  const total = rows.length;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const pages = Math.max(1, Math.ceil(total / limitNum));
  const start = (pageNum - 1) * limitNum;
  const customers = rows.slice(start, start + limitNum);

  return {
    customers,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages,
    },
  };
}

async function getCustomerDetail(companyId, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const emailRe = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const companyObjectId =
    companyId instanceof mongoose.Types.ObjectId
      ? companyId
      : new mongoose.Types.ObjectId(String(companyId));

  const [orders, tickets, user] = await Promise.all([
    StoreOrder.find({ company: companyObjectId, 'customer.email': emailRe })
      .select(
        'orderNumber name totalPrice currency placedAt financialStatus fulfillmentStatus lineItems statusUrl adminUrl customer',
      )
      .sort({ placedAt: -1 })
      .limit(25)
      .lean(),
    Ticket.find({
      company: companyObjectId,
      $or: [{ 'details.customerEmail': emailRe }, { 'email.fromAddress': emailRe }],
    })
      .select(
        'ticket_code ticket_title status priority source lastActivity createdAt details peoples createdBy',
      )
      .populate('createdBy', 'firstName lastName email role')
      .populate('peoples.user', 'firstName lastName email role')
      .sort({ lastActivity: -1, createdAt: -1 })
      .limit(40)
      .lean(),
    User.findOne({ company: companyObjectId, email: emailRe })
      .select('_id firstName lastName email')
      .lean(),
  ]);

  if (!orders.length && !tickets.length && !user) return null;

  const channels = new Set();
  let lastContactedAt = null;
  let openTicketCount = 0;
  let phone = null;
  let name = null;

  for (const ticket of tickets) {
    if (ticket.source) channels.add(ticket.source);
    const contactedAt = ticket.lastActivity || ticket.createdAt || null;
    if (
      contactedAt &&
      (!lastContactedAt || new Date(contactedAt) > new Date(lastContactedAt))
    ) {
      lastContactedAt = contactedAt;
    }
    if (['open', 'in_progress', 'on_hold'].includes(ticket.status)) openTicketCount += 1;
    if (!phone && ticket.details?.customerPhone) phone = String(ticket.details.customerPhone).trim();

    const customerPerson = (ticket.peoples || []).find((p) => p.role === 'customer' && p.user);
    const personUser = customerPerson?.user;
    if (!name && personUser && typeof personUser === 'object') {
      name = displayNameFromParts(null, personUser.firstName, personUser.lastName, normalized);
    }
  }

  const purchases = emptyPurchases();
  for (const order of orders) {
    if (!name && order.customer?.name) name = String(order.customer.name).trim();
    if (!phone && order.customer?.phone) phone = String(order.customer.phone).trim();
    purchases.orderCount += 1;
    purchases.totalSpend += Number(order.totalPrice) || 0;
    if (!purchases.currency && order.currency) purchases.currency = order.currency;
    const placedAt = order.placedAt || null;
    if (
      placedAt &&
      (!purchases.lastOrderAt || new Date(placedAt) > new Date(purchases.lastOrderAt))
    ) {
      purchases.lastOrderAt = placedAt;
      purchases.lastOrderNumber = order.orderNumber || order.name || null;
    }
    for (const item of order.lineItems || []) {
      if (item?.title && purchases.products.length < 8 && !purchases.products.includes(item.title)) {
        purchases.products.push(item.title);
      }
    }
  }

  if (!name && user) {
    name = displayNameFromParts(null, user.firstName, user.lastName, normalized);
  }

  purchases.totalSpend = Math.round((purchases.totalSpend || 0) * 100) / 100;
  purchases.currency = purchases.currency || 'USD';

  return {
    email: normalized,
    name: name || displayNameFromParts(null, null, null, normalized),
    phone,
    lastContactedAt,
    channels: [...channels],
    ticketCount: tickets.length,
    openTicketCount,
    purchases,
    userId: user?._id ? String(user._id) : null,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber || o.name || null,
      totalPrice: o.totalPrice,
      currency: o.currency || 'USD',
      placedAt: o.placedAt,
      financialStatus: o.financialStatus || null,
      fulfillmentStatus: o.fulfillmentStatus || null,
      products: (o.lineItems || []).map((li) => li.title).filter(Boolean),
      statusUrl: o.statusUrl || null,
      adminUrl: o.adminUrl || null,
    })),
    tickets: tickets.map((t) => ({
      ticketCode: t.ticket_code,
      title: t.ticket_title,
      status: t.status,
      priority: t.priority,
      source: t.source,
      at: t.lastActivity || t.createdAt,
    })),
  };
}

module.exports = {
  listCustomers,
  getCustomerDetail,
  resolveTicketEmail,
};
