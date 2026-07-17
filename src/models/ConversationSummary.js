const mongoose = require('mongoose');
const { Schema } = mongoose;

const conversationSummarySchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true, unique: true },
    summaryText: { type: String, default: '' },
    /** Marked lower-trust than verified workflow state */
    trustLevel: { type: String, enum: ['model_generated'], default: 'model_generated' },
    messageCountCovered: { type: Number, default: 0 },
    lastSummarizedAt: { type: Date },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

conversationSummarySchema.index({ company: 1, updatedAt: -1 });

module.exports = mongoose.model('ConversationSummary', conversationSummarySchema);
