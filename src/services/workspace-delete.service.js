const mongoose = require('mongoose');

const Company = require('../models/Company');
const User = require('../models/User');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Ticket = require('../models/Ticket');
const HelpCenter = require('../models/HelpCenter');
const Counter = require('../models/Counter');
const ActivityLog = require('../models/ActivityLog');
const ChatSession = require('../models/ChatSession');
const ChatKnowledge = require('../models/ChatKnowledge');
const ContactRequest = require('../models/ContactRequest');
const ConversationSummary = require('../models/ConversationSummary');
const LiveChatRating = require('../models/LiveChatRating');
const PendingAgentAction = require('../models/PendingAgentAction');
const StoreOrder = require('../models/StoreOrder');
const StoreProduct = require('../models/StoreProduct');
const TicketTrackSession = require('../models/TicketTrackSession');
const SupportIncident = require('../models/SupportIncident');
const AssistantConflictAudit = require('../models/AssistantConflictAudit');

/**
 * Permanently delete a workspace and all tenant-scoped data.
 * Intended for owner/admin product flow (not the ops CLI).
 */
async function deleteWorkspace(companyId) {
  const id = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;
  const company = await Company.findById(id);
  if (!company) {
    const err = new Error('Workspace not found');
    err.statusCode = 404;
    throw err;
  }

  const scope = `company:${id.toString()}`;

  await Promise.all([
    User.deleteMany({ company: id }),
    Department.deleteMany({ company: id }),
    Team.deleteMany({ company: id }),
    Ticket.deleteMany({ company: id }),
    HelpCenter.deleteMany({ company: id }),
    Counter.deleteMany({ scope }),
    ActivityLog.deleteMany({ company: id }),
    ChatSession.deleteMany({ company: id }),
    ChatKnowledge.deleteMany({ company: id }),
    ContactRequest.deleteMany({ company: id }),
    ConversationSummary.deleteMany({ company: id }),
    LiveChatRating.deleteMany({ company: id }),
    PendingAgentAction.deleteMany({ company: id }),
    StoreOrder.deleteMany({ company: id }),
    StoreProduct.deleteMany({ company: id }),
    TicketTrackSession.deleteMany({ company: id }),
    SupportIncident.deleteMany({ company: id }),
    AssistantConflictAudit.deleteMany({ company: id }),
  ]);

  await Company.deleteOne({ _id: id });

  return {
    subdomain: company.subdomain,
    name: company.name,
  };
}

module.exports = { deleteWorkspace };
