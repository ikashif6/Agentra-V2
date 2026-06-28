const mongoose = require('mongoose');

/**
 * Counter Model
 *
 * A simple, atomic counter store.  Each counter is identified by a (scope, key)
 * pair so the same key can exist independently per company/tenant.
 *
 * Usage:
 *   const { value } = await Counter.increment('company:<id>', 'totalTickets');
 *   const { value } = await Counter.increment('company:<id>', 'totalTickets', -1); // decrement
 *   const current   = await Counter.get('company:<id>', 'totalTickets');
 */

const counterSchema = new mongoose.Schema(
  {
    // e.g. "company:64fa..." — scopes the counter to a tenant
    scope: { type: String, required: true },
    // e.g. "totalTickets"
    key:   { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: false }
);

// Compound unique index — one doc per (scope, key)
counterSchema.index({ scope: 1, key: 1 }, { unique: true });

/**
 * Atomically increment (or decrement) a counter.
 * Creates the doc with value = amount if it doesn't exist yet (upsert).
 * Returns the NEW value.
 */
counterSchema.statics.increment = async function (scope, key, amount = 1) {
  const doc = await this.findOneAndUpdate(
    { scope, key },
    { $inc: { value: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.value;
};

/**
 * Read the current value of a counter (0 if it doesn't exist yet).
 */
counterSchema.statics.get = async function (scope, key) {
  const doc = await this.findOne({ scope, key });
  return doc ? doc.value : 0;
};

module.exports = mongoose.model('Counter', counterSchema);
