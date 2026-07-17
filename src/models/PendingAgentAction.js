const mongoose = require('mongoose');
const { Schema } = mongoose;

const pendingAgentActionSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
    actionId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'create_return',
        'create_exchange',
        'cancel_order',
        'change_address',
        'issue_refund',
        'issue_store_credit',
        'apply_discount',
        'contact_request',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['awaiting_confirmation', 'confirmed', 'executed', 'expired', 'cancelled', 'failed'],
      default: 'awaiting_confirmation',
      index: true,
    },
    arguments: { type: Schema.Types.Mixed, default: {} },
    confirmationTokenHash: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    confirmedAt: { type: Date },
    executedAt: { type: Date },
    result: { type: Schema.Types.Mixed },
    errorCode: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

pendingAgentActionSchema.index({ company: 1, session: 1, status: 1 });

module.exports = mongoose.model('PendingAgentAction', pendingAgentActionSchema);
