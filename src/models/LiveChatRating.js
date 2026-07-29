const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Immutable evaluation record for a resolved live-chat conversation.
 * Keeping this separate from Ticket makes per-agent CSAT queries cheap and
 * preserves who was evaluated even if the ticket is reassigned later. Ratings
 * for AI-only conversations have no agent because they evaluate the experience,
 * not an individual teammate.
 */
const liveChatRatingSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      unique: true,
    },
    agent: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    label: {
      type: String,
      required: true,
      enum: ['very_bad', 'bad', 'okay', 'good', 'excellent'],
    },
    visitorEmail: { type: String, lowercase: true, trim: true },
    resolvedAt: { type: Date },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

liveChatRatingSchema.index({ company: 1, agent: 1, submittedAt: -1 });
liveChatRatingSchema.index({ company: 1, agent: 1, rating: 1 });

module.exports = mongoose.model('LiveChatRating', liveChatRatingSchema);
