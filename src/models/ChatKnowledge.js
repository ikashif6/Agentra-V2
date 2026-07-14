const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatKnowledgeSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 50000 },
    category: { type: String, trim: true, default: 'general' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

chatKnowledgeSchema.index({ company: 1, active: 1, sortOrder: 1 });

module.exports = mongoose.model('ChatKnowledge', chatKnowledgeSchema);
