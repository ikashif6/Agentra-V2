const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatKnowledgeSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 50000 },
    category: { type: String, trim: true, default: 'general' },
    /** article | macro | guide | policy | troubleshooting */
    kind: {
      type: String,
      enum: ['article', 'macro', 'guide', 'policy', 'troubleshooting'],
      default: 'article',
    },
    /** draft requires approval; published is AI-retrievable when active */
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
      index: true,
    },
    source: {
      type: String,
      enum: ['manual', 'ai_draft', 'document'],
      default: 'manual',
    },
    draftMeta: {
      topic: { type: String },
      ticketCodes: [{ type: String }],
      reason: { type: String },
      generatedAt: { type: Date },
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

chatKnowledgeSchema.index({ company: 1, active: 1, sortOrder: 1 });
chatKnowledgeSchema.index({ company: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ChatKnowledge', chatKnowledgeSchema);
