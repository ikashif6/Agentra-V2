const mongoose = require('mongoose');

/**
 * Company (Tenant) Model
 * Each company is a tenant. Their subdomain is used as the tenancy identifier.
 * e.g. lyca.agentraa.com → subdomain = "lyca"
 */

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'free',
    },
    maxUsers: { type: Number, default: 5 },
    maxTickets: { type: Number, default: 100 },
    maxAgents: { type: Number, default: 2 },
    features: {
      customDomain: { type: Boolean, default: false },
      slaManagement: { type: Boolean, default: false },
      advancedReporting: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'lifetime'],
      default: 'monthly',
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
      default: 'trialing',
    },
    trialEndsAt: { type: Date },
  },
  { _id: false }
);

const usageSchema = new mongoose.Schema(
  {
    totalUsers: { type: Number, default: 0 },
    totalAgents: { type: Number, default: 0 },
    totalTickets: { type: Number, default: 0 },
    openTickets: { type: Number, default: 0 },
    resolvedTickets: { type: Number, default: 0 },
    totalDepartments: { type: Number, default: 0 },
    storageUsedMB: { type: Number, default: 0 },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },

    // The core tenancy identifier — lyca.agentraa.com → subdomain = "lyca"
    subdomain: {
      type: String,
      required: [true, 'Subdomain is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
        'Subdomain can only contain lowercase letters, numbers, and hyphens',
      ],
      minlength: [2, 'Subdomain must be at least 2 characters'],
      maxlength: [63, 'Subdomain cannot exceed 63 characters'],
    },

    // Custom domain support (pro/enterprise)
    customDomain: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    customDomainVerified: { type: Boolean, default: false },

    // Help center custom domain (e.g. help.acme.com)
    // Mirrored from HelpCenter doc for fast CORS / middleware lookups
    helpCenterDomain: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    helpCenterDomainVerified: { type: Boolean, default: false },

    // Owner — the user who created/registered the company
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Basic profile
    logo: { type: String },
    industry: { type: String },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    website: { type: String },
    phone: { type: String },
    timezone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },

    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // Plan & billing
    plan: { type: planSchema, default: () => ({}) },

    // Usage counters (updated incrementally, not on every request)
    usage: { type: usageSchema, default: () => ({}) },

    // Settings
    settings: {
      allowPublicSignup: { type: Boolean, default: false },
      requireEmailVerification: { type: Boolean, default: true },
      defaultTicketPriority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
      },
      autoAssignTickets: { type: Boolean, default: false },
      ticketPrefix: { type: String, default: 'TKT' },
      businessHours: {
        enabled: { type: Boolean, default: false },
        timezone: String,
        schedule: mongoose.Schema.Types.Mixed,
      },
      notificationEmail: { type: String },
      supportEmail: { type: String },
    },

    // Status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    suspendedAt: { type: Date },
    suspendReason: { type: String },

    // Metadata
    registeredAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: full subdomain URL
companySchema.virtual('subdomainUrl').get(function () {
  return `https://${this.subdomain}.${process.env.APP_BASE_DOMAIN || 'agentraa.com'}`;
});

// Indexes
companySchema.index({ subdomain: 1 });
companySchema.index({ owner: 1 });
companySchema.index({ isActive: 1 });
companySchema.index({ 'plan.status': 1 });

module.exports = mongoose.model('Company', companySchema);
