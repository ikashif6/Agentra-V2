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
      enum: ['text', 'order_card', 'product_cards', 'sources', 'system_event'],
      default: 'text',
    },
    payload: { type: Schema.Types.Mixed },
    senderName: { type: String },
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
  },
  { timestamps: true },
);

chatSessionSchema.index({ company: 1, visitorEmail: 1, updatedAt: -1 });
chatSessionSchema.index({ company: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
