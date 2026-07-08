const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Ticket Model
 *
 * ticket_code     : human-readable unique ID  e.g. TKT-00042
 * company_subdomain embedded for fast look-up by code without a company join
 * peoples         : every stakeholder in the ticket (customer, extra customers added by agents, assigned agent)
 *                   Owner / admin are NOT listed here — they can see every ticket in their company
 * messages        : conversation thread (sender ref + body + optional attachments)
 */

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String },
    size: { type: Number }, // bytes
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // For guest / track-session senders we store their email as a fallback
    senderEmail: { type: String },
    body: {
      type: String,
      required: [true, 'Message body is required'],
      maxlength: [50000, 'Message cannot exceed 50 000 characters'],
    },
    attachments: { type: [attachmentSchema], default: [] },
    sentAt: { type: Date, default: Date.now },
    // Internal notes (only visible to agents / admins / owner)
    isInternal: { type: Boolean, default: false },
  },
  { _id: true }
);

const peopleSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // 'customer' | 'agent' | 'cc'
    role: {
      type: String,
      enum: ['customer', 'agent', 'cc'],
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // null = self (creator)
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const ticketSchema = new Schema(
  {
    // ── Identification ────────────────────────────────────────────────────────
    ticket_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Denormalized for quick public tracking (no company join needed)
    company_subdomain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    ticket_title: {
      type: String,
      required: [true, 'Ticket title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    ticket_description: {
      type: String,
      required: [true, 'Ticket description is required'],
      maxlength: [50000, 'Description cannot exceed 50 000 characters'],
    },

    // ── Classification ────────────────────────────────────────────────────────
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },

    // Multiple teams can be assigned
    teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    status: {
      type: String,
      enum: [
        'open',
        'in_progress',
        'on_hold',
        'resolved',
        'closed',       // closed by agent/admin/owner
        'self_closed',  // closed by customer themselves
      ],
      default: 'open',
    },

    inboxFolder: {
      type: String,
      enum: ['inbox', 'snoozed', 'trash', 'spam'],
      default: 'inbox',
    },

    snoozedUntil: { type: Date },

    // ── Channel & classification metadata ─────────────────────────────────────
    source: {
      type: String,
      enum: ['portal', 'email', 'chat', 'chatbot', 'instagram', 'facebook', 'whatsapp'],
      default: 'portal',
    },

    tags: [{ type: String, trim: true }],

    isUnread: { type: Boolean, default: false },

    // ── Facebook Messenger linkage (source === 'facebook') ────────────────────
    // Lets inbound webhooks find the right conversation and lets agent replies
    // route back to the correct Messenger recipient.
    facebook: {
      pageId: { type: String },
      psid: { type: String }, // Page-scoped ID of the Messenger user
    },

    // ── Instagram DM linkage (source === 'instagram') ─────────────────────────
    instagram: {
      igUserId: { type: String }, // our Instagram business account id
      igsid: { type: String }, // Instagram-scoped ID of the customer
    },

    details: {
      contactReason: { type: String, default: '' },
      product: { type: String, default: '' },
      resolution: { type: String, default: '' },
      customerType: { type: String, default: '' },
      customerNote: { type: String, default: '' },
      customerPhone: { type: String, default: '' },
      customerEmail: { type: String, default: '' },
    },

    // ── Attachments (top-level; messages can also have attachments) ───────────
    attachments: { type: [attachmentSchema], default: [] },

    // ── Stakeholders ──────────────────────────────────────────────────────────
    // Does NOT include owner / admin — they see all tickets in their company
    peoples: { type: [peopleSchema], default: [] },

    // Convenience shortcut — the primary assigned agent (also reflected in peoples)
    assigned_agent: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    // ── Conversation ──────────────────────────────────────────────────────────
    messages: { type: [messageSchema], default: [] },

    // ── Activity ──────────────────────────────────────────────────────────────
    lastActivity: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Created by ───────────────────────────────────────────────────────────
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
ticketSchema.index({ company: 1, status: 1 });
ticketSchema.index({ company: 1, createdAt: -1 });
ticketSchema.index({ ticket_code: 1 }, { unique: true });
ticketSchema.index({ company_subdomain: 1, ticket_code: 1 });
ticketSchema.index({ 'peoples.user': 1 });
ticketSchema.index({ assigned_agent: 1 });
ticketSchema.index({ company: 1, inboxFolder: 1, status: 1 });
ticketSchema.index({ company: 1, source: 1, 'facebook.psid': 1 });
ticketSchema.index({ company: 1, source: 1, 'instagram.igsid': 1 });

// ─── Static: generate the next ticket code for a company ─────────────────────
ticketSchema.statics.generateCode = async function (companyId, prefix = 'TKT') {
  // Count all tickets for this company and use +1 as the sequence
  const count = await this.countDocuments({ company: companyId });
  const seq = String(count + 1).padStart(5, '0');
  return `${prefix.toUpperCase()}-${seq}`;
};

module.exports = mongoose.model('Ticket', ticketSchema);
