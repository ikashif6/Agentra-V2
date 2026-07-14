const mongoose = require('mongoose');

const supportIncidentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    ticketCodes: [{ type: String }],
    ticketCount: { type: Number, default: 0 },
    windowMinutes: { type: Number, default: 45 },
    status: {
      type: String,
      enum: ['open', 'monitoring', 'resolved'],
      default: 'open',
    },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

supportIncidentSchema.index({ company: 1, key: 1 }, { unique: true });
supportIncidentSchema.index({ company: 1, status: 1, lastSeenAt: -1 });

module.exports = mongoose.model('SupportIncident', supportIncidentSchema);
