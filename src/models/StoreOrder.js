const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * StoreOrder Model
 *
 * A normalized snapshot of an order synced from a connected e-commerce store
 * (Shopify, WooCommerce, or a custom storefront). Orders are matched to support
 * conversations by the customer's email / phone so agents see order context
 * right inside the inbox.
 *
 * One document per (company, provider, externalId). Upserted on sync + webhook.
 */

const lineItemSchema = new Schema(
  {
    externalId: { type: String },
    title: { type: String },
    variantTitle: { type: String },
    sku: { type: String },
    quantity: { type: Number, default: 1 },
    fulfillableQuantity: { type: Number },
    price: { type: Number },
    imageUrl: { type: String },
    grams: { type: Number },
  },
  { _id: false },
);

const shippingLineSchema = new Schema(
  {
    title: { type: String },
    price: { type: Number },
  },
  { _id: false },
);

const taxLineSchema = new Schema(
  {
    title: { type: String },
    rate: { type: Number },
    price: { type: Number },
  },
  { _id: false },
);

const fulfillmentSchema = new Schema(
  {
    status: { type: String },
    trackingCompany: { type: String },
    trackingNumber: { type: String },
    trackingUrl: { type: String },
    shippedAt: { type: Date },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    name: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    province: { type: String },
    zip: { type: String },
    country: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

const storeOrderSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['shopify', 'woocommerce', 'custom'],
      required: true,
    },

    // Provider's own id for the order (used for idempotent upserts)
    externalId: { type: String, required: true },
    // Human-facing order number, e.g. "#1001"
    orderNumber: { type: String },
    name: { type: String },

    currency: { type: String },
    totalPrice: { type: Number },
    subtotalPrice: { type: Number },
    totalShipping: { type: Number },
    totalTax: { type: Number },
    financialStatus: { type: String }, // paid | pending | refunded | ...
    fulfillmentStatus: { type: String }, // fulfilled | unfulfilled | partial | ...
    channel: { type: String },
    tags: [{ type: String }],
    note: { type: String },
    itemCount: { type: Number },
    onHold: { type: Boolean, default: false },
    shippingMethod: { type: String },
    shippingLines: [shippingLineSchema],
    taxLines: [taxLineSchema],
    totalWeightGrams: { type: Number },
    fulfillmentService: { type: String },
    closedAt: { type: Date }, // archived in Shopify — NOT cancelled
    cancelledAt: { type: Date },
    cancelReason: { type: String },

    customer: {
      externalId: { type: String },
      name: { type: String },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
    },

    shippingAddress: addressSchema,
    billingAddress: addressSchema,

    lineItems: [lineItemSchema],
    fulfillments: [fulfillmentSchema],

    // Customer-facing order status page + admin deep link
    statusUrl: { type: String },
    adminUrl: { type: String },

    placedAt: { type: Date },
    updatedAtStore: { type: Date },

    // Full provider payload (hidden by default; handy for debugging / future use)
    raw: { type: Schema.Types.Mixed, select: false },
  },
  { timestamps: true },
);

storeOrderSchema.index(
  { company: 1, provider: 1, externalId: 1 },
  { unique: true },
);
storeOrderSchema.index({ company: 1, 'customer.email': 1, placedAt: -1 });
storeOrderSchema.index({ company: 1, 'customer.phone': 1, placedAt: -1 });
storeOrderSchema.index({ company: 1, placedAt: -1 });

module.exports = mongoose.model('StoreOrder', storeOrderSchema);
