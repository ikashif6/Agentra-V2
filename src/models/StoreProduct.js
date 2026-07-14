const mongoose = require('mongoose');
const { Schema } = mongoose;

const storeProductSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    provider: {
      type: String,
      enum: ['shopify', 'woocommerce', 'custom'],
      required: true,
    },
    externalId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    handle: { type: String },
    imageUrl: { type: String },
    price: { type: Number },
    compareAtPrice: { type: Number },
    currency: { type: String },
    productUrl: { type: String },
    vendor: { type: String },
    productType: { type: String },
    tags: [{ type: String, trim: true }],
    status: { type: String, default: 'active' },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

storeProductSchema.index({ company: 1, provider: 1, externalId: 1 }, { unique: true });
storeProductSchema.index({ company: 1, title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('StoreProduct', storeProductSchema);
