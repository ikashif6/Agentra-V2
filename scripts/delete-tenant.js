require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const HelpCenter = require('../src/models/HelpCenter');
const Counter = require('../src/models/Counter');

async function deleteTenant(subdomain) {
  await mongoose.connect(process.env.MONGODB_URI);

  const company = await Company.findOne({ subdomain: subdomain.toLowerCase() });
  if (!company) {
    console.log(`No company found for subdomain: ${subdomain}`);
    await mongoose.disconnect();
    return;
  }

  const id = company._id;
  const scope = `company:${id.toString()}`;

  const [users, depts, teams, tickets, help, counters] = await Promise.all([
    User.deleteMany({ company: id }),
    Department.deleteMany({ company: id }),
    Team.deleteMany({ company: id }),
    Ticket.deleteMany({ company: id }),
    HelpCenter.deleteMany({ company: id }),
    Counter.deleteMany({ scope }),
  ]);

  await Company.deleteOne({ _id: id });

  console.log(`Deleted workspace: ${subdomain}`);
  console.log({
    users: users.deletedCount,
    departments: depts.deletedCount,
    teams: teams.deletedCount,
    tickets: tickets.deletedCount,
    helpCenters: help.deletedCount,
    counters: counters.deletedCount,
  });

  await mongoose.disconnect();
}

const subdomain = process.argv[2] || 'thebuildclub';
deleteTenant(subdomain).catch((err) => {
  console.error(err);
  process.exit(1);
});
