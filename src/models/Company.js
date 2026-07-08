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
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date },
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
    branding: {
      primaryColor: { type: String, default: '#D85A30' },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'light',
      },
    },
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

    billing: {
      paymentMethod: {
        type: { type: String, enum: ['card', 'invoice'] },
        brand: String,
        last4: String,
        expMonth: Number,
        expYear: Number,
        name: String,
      },
      invoices: [
        {
          number: { type: String, required: true },
          issuedAt: { type: Date, required: true },
          amount: { type: Number, required: true },
          currency: { type: String, default: 'USD' },
          status: {
            type: String,
            enum: ['paid', 'open', 'void', 'draft'],
            default: 'paid',
          },
          description: String,
          pdfUrl: String,
        },
      ],
    },

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
      customBusinessHours: [
        {
          name: { type: String, required: true, trim: true },
          targets: [{ type: String }],
          timezone: { type: String, required: true },
          schedule: { type: mongoose.Schema.Types.Mixed, required: true },
        },
      ],
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

    // Post-signup questionnaire (wizard answers)
    onboardingSetup: {
      teamGoal: { type: String },
      channels: [{ type: String }],
      ticketVolume: { type: String },
      ecommercePlatform: { type: String },
      aiInterest: { type: String },
      completedAt: { type: Date },
    },

    // E-commerce store connection (Shopify, WooCommerce, custom)
    storeIntegration: {
      provider: {
        type: String,
        enum: ['shopify', 'woocommerce', 'custom'],
      },
      status: {
        type: String,
        enum: ['disconnected', 'pending', 'connected', 'error'],
        default: 'disconnected',
      },
      connectedAt: { type: Date },
      lastSyncAt: { type: Date },
      lastError: { type: String },
      shopify: {
        shopDomain: { type: String },
        accessToken: { type: String, select: false },
        shopName: { type: String },
      },
      woocommerce: {
        storeUrl: { type: String },
        consumerKey: { type: String, select: false },
        consumerSecret: { type: String, select: false },
        storeName: { type: String },
      },
      custom: {
        storeUrl: { type: String },
        apiKey: { type: String, select: false },
        webhookSecret: { type: String, select: false },
        storeName: { type: String },
      },
      syncSettings: {
        syncOrders: { type: Boolean, default: true },
        syncCustomers: { type: Boolean, default: true },
        syncProducts: { type: Boolean, default: false },
      },
    },

    // Messaging channel connections (Facebook Messenger, etc.)
    channelIntegrations: {
      facebook: {
        status: {
          type: String,
          enum: ['disconnected', 'pending', 'connected', 'error'],
          default: 'disconnected',
        },
        connectedAt: { type: Date },
        lastError: { type: String },
        pageId: { type: String },
        pageName: { type: String },
        pagePictureUrl: { type: String },
        pageAccessToken: { type: String, select: false },
        userAccessToken: { type: String, select: false },
        pendingPages: [
          {
            id: { type: String },
            name: { type: String },
            category: { type: String },
            pictureUrl: { type: String },
          },
        ],
      },
      instagram: {
        status: {
          type: String,
          enum: ['disconnected', 'pending', 'connected', 'error'],
          default: 'disconnected',
        },
        connectedAt: { type: Date },
        lastError: { type: String },
        igUserId: { type: String }, // Instagram business account id
        igUsername: { type: String },
        igPictureUrl: { type: String },
        pageId: { type: String }, // linked Facebook Page id
        pageName: { type: String },
        pageAccessToken: { type: String, select: false },
        userAccessToken: { type: String, select: false },
        pendingAccounts: [
          {
            igUserId: { type: String },
            igUsername: { type: String },
            igPictureUrl: { type: String },
            pageId: { type: String },
            pageName: { type: String },
          },
        ],
      },
    },
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
