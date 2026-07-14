require('dotenv').config();

const mongoose = require('mongoose');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Ticket = require('../src/models/Ticket');
const ticketController = require('../src/controllers/ticket.controller');

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];
const LIVE_CHAT_SOURCES = ['chatbot', 'chat'];

function aiAgentOwnedClause() {
  return {
    assigned_agent: null,
    $and: [
      {
        $or: [
          { 'aiIntelligence.handoffReason': { $exists: false } },
          { 'aiIntelligence.handoffReason': null },
          { 'aiIntelligence.handoffReason': '' },
        ],
      },
      {
        $or: [
          { source: { $in: LIVE_CHAT_SOURCES } },
          { messages: { $elemMatch: { isAi: true } } },
          { messages: { $elemMatch: { senderEmail: 'bot@agentra.local' } } },
        ],
      },
    ],
  };
}

async function countForCompany(companyId) {
  const base = { company: companyId, inboxFolder: 'inbox' };
  const aiOwned = aiAgentOwnedClause();

  const [inboxActive, aiActive, inboxTotal, aiTotal] = await Promise.all([
    Ticket.countDocuments({
      ...base,
      status: { $in: ACTIVE_STATUSES },
      $nor: [aiOwned],
    }),
    Ticket.countDocuments({
      ...base,
      status: { $in: ACTIVE_STATUSES },
      ...aiOwned,
    }),
    Ticket.countDocuments({
      company: companyId,
      inboxFolder: { $nin: ['trash', 'spam'] },
      $nor: [aiOwned],
    }),
    Ticket.countDocuments({
      company: companyId,
      inboxFolder: { $nin: ['trash', 'spam'] },
      ...aiOwned,
    }),
  ]);

  return { inboxActive, aiActive, inboxTotal, aiTotal };
}

async function main() {
  const subdomainArg = process.argv[2];

  await mongoose.connect(process.env.MONGODB_URI);

  const company = subdomainArg
    ? await Company.findOne({ subdomain: subdomainArg.toLowerCase(), isActive: true })
    : await Company.findOne({ isActive: true }).sort({ updatedAt: -1 });

  if (!company) {
    console.error(subdomainArg
      ? `Workspace not found: ${subdomainArg}`
      : 'No active workspace found');
    process.exit(1);
  }

  const user = await User.findOne({
    company: company._id,
    role: { $in: ['owner', 'admin', 'agent'] },
    isActive: true,
  }).sort({ role: 1 });

  if (!user) {
    console.error(`No staff user found for workspace: ${company.subdomain}`);
    process.exit(1);
  }

  console.log(`Loading demo data for ${company.name} (${company.subdomain}) as ${user.email}…`);

  let payload = null;
  const res = {
    status() {
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };

  await ticketController.createDemoTicket({ company, user }, res, (err) => {
    if (err) throw err;
  });

  const counts = await countForCompany(company._id);

  console.log('\nDemo load complete.');
  console.log({
    message: payload?.message,
    created: payload?.data?.created,
    inboxCount: payload?.data?.inboxCount,
    liveChatCount: payload?.data?.liveChatCount ?? payload?.data?.aiAgentCount,
    totalReturned: payload?.data?.tickets?.length,
  });
  console.log('\nWorkspace ticket counts:');
  console.log(counts);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
