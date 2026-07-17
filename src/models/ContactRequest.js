const mongoose = require('mongoose');
const { Schema } = mongoose;

const contactRequestSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'ChatSession', index: true },
    requestId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['draft', 'awaiting_confirmation', 'submitted', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    name: { type: String },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    preferredMethod: { type: String, enum: ['email', 'phone', 'sms', 'whatsapp', null], default: null },
    preferredContactWindow: { type: String },
    timezone: { type: String },
    issueSummary: { type: String },
    consentToContact: { type: Boolean, default: false },
    idempotencyKey: { type: String, unique: true, sparse: true },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

contactRequestSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('ContactRequest', contactRequestSchema);
