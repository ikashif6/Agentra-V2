require('dotenv').config();

const mongoose = require('mongoose');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Ticket = require('../src/models/Ticket');
const ticketController = require('../src/controllers/ticket.controller');

const AI_AGENT_SOURCES = ['chatbot', 'chat'];
const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];

async function countForCompany(companyId) {
  const base = { company: companyId, inboxFolder: 'inbox' };

  const [inboxActive, aiActive, inboxTotal, aiTotal] = await Promise.all([
    Ticket.countDocuments({
      ...base,
      source: { $nin: AI_AGENT_SOURCES },
      status: { $in: ACTIVE_STATUSES },
    }),
    Ticket.countDocuments({
      ...base,
      source: { $in: AI_AGENT_SOURCES },
      status: { $in: ACTIVE_STATUSES },
    }),
    Ticket.countDocuments({
      company: companyId,
      source: { $nin: AI_AGENT_SOURCES },
      inboxFolder: { $nin: ['trash', 'spam'] },
    }),
    Ticket.countDocuments({
      company: companyId,
      source: { $in: AI_AGENT_SOURCES },
      inboxFolder: { $nin: ['trash', 'spam'] },
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
