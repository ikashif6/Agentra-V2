const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatMessageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ['customer', 'bot', 'agent', 'system'],
      required: true,
    },
    body: { type: String, default: '' },
    contentType: {
      type: String,
      enum: ['text', 'order_card', 'product_cards', 'sources', 'system_event', 'input_form'],
      default: 'text',
    },
    payload: { type: Schema.Types.Mixed },
    attachments: {
      type: [
        {
          url: { type: String, required: true },
          filename: { type: String, required: true },
          mimetype: { type: String },
          size: { type: Number },
        },
      ],
      default: [],
    },
    senderName: { type: String },
    /** Profile picture of the human agent, so the widget shows them and not the bot */
    senderAvatar: { type: String },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const verifiedOrderSchema = new Schema(
  {
    externalId: { type: String, required: true },
    orderNumber: { type: String },
    verifiedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSessionSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', index: true },
    sessionToken: { type: String, required: true, unique: true, index: true },
    visitorEmail: { type: String, required: true, lowercase: true, trim: true },
    /** Email confirmed in-chat for order lookups (may differ from pre-chat gate email). */
    orderLookupEmail: { type: String, lowercase: true, trim: true },
    /** Order number collected while waiting for the matching email (or vice versa). */
    pendingOrderNumber: { type: String, trim: true },
    /** Deterministic workflow state (entities, steps) — not LLM memory. */
    workflowState: { type: Schema.Types.Mixed, default: () => ({}) },
    /** Human handoff state machine — sole source of truth for connecting UI. */
    handoffState: { type: Schema.Types.Mixed, default: () => ({}) },
    /** Standalone Chatbot AI Agent conversation mapping (bridge only). */
    chatbotBridge: {
      conversationId: { type: String },
      sessionToken: { type: String },
      workspaceId: { type: String },
    },
    status: {
      type: String,
      enum: ['active', 'waiting_human', 'with_human', 'closed'],
      default: 'active',
    },
    handoffRequestedAt: { type: Date },
    assignedAgent: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedOrders: { type: [verifiedOrderSchema], default: [] },
    messages: { type: [chatMessageSchema], default: [] },
    metadata: {
      pageUrl: { type: String },
      origin: { type: String },
      userAgent: { type: String },
    },
    lastActivityAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    resolution: {
      resolvedAt: { type: Date },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      resolvedAgent: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      label: { type: String },
      requestedAt: { type: Date },
      submittedAt: { type: Date },
    },
    transcriptEmail: {
      sentAt: { type: Date },
      to: { type: String },
      messageId: { type: String },
    },
  },
  { timestamps: true },
);

chatSessionSchema.index({ company: 1, visitorEmail: 1, updatedAt: -1 });
chatSessionSchema.index({ company: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
