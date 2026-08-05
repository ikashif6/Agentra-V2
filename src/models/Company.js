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
    paddleCustomerId: { type: String },
    paddleSubscriptionId: { type: String },
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
      favicon: { type: String },
      logoDark: { type: String },
      /** Browser tab title — defaults to company name when empty */
      browserTitle: { type: String, trim: true, maxlength: 80 },
      /** Short workspace tagline shown in the app header */
      tagline: { type: String, trim: true, maxlength: 160 },
      logoWidth: { type: Number, default: 148, min: 24, max: 280 },
      logoHeight: { type: Number, default: 28, min: 16, max: 120 },
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

    // Home setup checklist — sticky done flags (once true, stay true) + completedAt
    setupChecklist: {
      store: { type: Boolean, default: false },
      channels: { type: Boolean, default: false },
      ai: { type: Boolean, default: false },
      workspace: { type: Boolean, default: false },
      team: { type: Boolean, default: false },
      completedAt: { type: Date },
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
      // When true, secret fields below are AES-encrypted at rest (utils/crypto).
      encrypted: { type: Boolean, default: false },
      // Whether provider-side webhooks were auto-registered for real-time sync.
      webhooksRegistered: { type: Boolean, default: false },
      shopify: {
        shopDomain: { type: String },
        accessToken: { type: String, select: false },
        /** Expiring offline token refresh (Shopify public apps). */
        refreshToken: { type: String, select: false },
        accessTokenExpiresAt: { type: Date },
        refreshTokenExpiresAt: { type: Date },
        scope: { type: String },
        shopName: { type: String },
      },
      woocommerce: {
        storeUrl: { type: String },
        consumerKey: { type: String, select: false },
        consumerSecret: { type: String, select: false },
        webhookSecret: { type: String, select: false },
        storeName: { type: String },
      },
      custom: {
        storeUrl: { type: String },
        apiKey: { type: String, select: false },
        webhookSecret: { type: String, select: false },
        storeName: { type: String },
        supportedActions: [{ type: String }],
        features: {
          conversion: { type: Boolean, default: true },
          edit: { type: Boolean, default: true },
        },
      },
      syncSettings: {
        syncOrders: { type: Boolean, default: true },
        syncCustomers: { type: Boolean, default: true },
        syncProducts: { type: Boolean, default: true },
      },
    },

    // Live chat widget + AI agent (Settings → Channels → Live chat)
    liveChat: {
      enabled: { type: Boolean, default: false },
      widgetKey: { type: String, index: true, sparse: true },
      widgetInstalled: { type: Boolean, default: false },
      installMethod: { type: String, enum: ['shopify_script', 'manual', null], default: null },
      shopifyScriptTagId: { type: String },
      allowedOrigins: [{ type: String, trim: true }],
      appearance: {
        brandColor: { type: String, default: '#2563eb' },
        backgroundColor: { type: String, default: '#ffffff' },
        fontFamily: { type: String, default: 'Plus Jakarta Sans' },
        logoUrl: { type: String },
        faviconUrl: { type: String },
        logoSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
        logoWidth: { type: Number, default: 120, min: 24, max: 280 },
        logoHeight: { type: Number, default: 40, min: 16, max: 120 },
        position: { type: String, enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
        launcherOffsetX: { type: Number, default: 20 },
        launcherOffsetY: { type: Number, default: 20 },
        showBranding: { type: Boolean, default: true },
      },
      content: {
        storeDisplayName: { type: String },
        agentName: { type: String, default: 'Support Assistant' },
        welcomeTitle: { type: String, default: 'Hi there 👋\nHow can we help?' },
        welcomeSubtitle: {
          type: String,
          default: 'Ask about orders, products, returns & store support.',
        },
        welcomeMessage: {
          type: String,
          default:
            "Hi! Welcome — I can help with orders, products, returns, and store questions. How can I help you today?",
        },
        emailGateTitle: { type: String, default: 'Start a conversation' },
        emailGateSubtitle: {
          type: String,
          default: 'Enter your email so we can follow up with you.',
        },
        privacyNotice: {
          type: String,
          default:
            'This chat is AI-powered for faster assistance. Chats are monitored and recorded.',
        },
        privacyPolicyLabel: { type: String, default: 'Privacy Policy' },
        privacyPolicyUrl: { type: String, default: '' },
        askAnythingLabel: { type: String, default: 'Ask me anything' },
        followUpReplies: [{ type: String, trim: true }],
        offlineMessage: {
          type: String,
          default: 'Our team is currently away. The assistant can still help, or you can leave a message.',
        },
        quickReplies: [{ type: String, trim: true }],
      },
      behavior: {
        typingIndicator: { type: Boolean, default: true },
        retrievalIndicator: { type: Boolean, default: true },
        requireEmailBeforeChat: { type: Boolean, default: true },
        requireOrderVerification: { type: Boolean, default: true },
        handoffOnlyInBusinessHours: { type: Boolean, default: true },
      },
      ai: {
        enabled: { type: Boolean, default: true },
        instructions: { type: String, default: '' },
        escalationKeywords: {
          type: [String],
          default: [
            'talk to a human',
            'speak to someone',
            'real person',
            'human agent',
            'connect me with an agent',
          ],
        },
        allowedActions: {
          lookupOrder: { type: Boolean, default: true },
          cancelOrder: { type: Boolean, default: false },
          refundOrder: { type: Boolean, default: true },
          maxRefundAmount: { type: Number, default: 100 },
          editOrder: { type: Boolean, default: false },
          productRecommendations: { type: Boolean, default: true },
          requestHuman: { type: Boolean, default: true },
        },
      },
      connectedAt: { type: Date },
      lastError: { type: String },
      // Human agents allowed to handle live chat (portal assign + widget faces)
      agents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },

    // Multi-channel AI Agent — shared defaults (liveChat.ai) + optional per-channel overrides
    aiAgent: {
      /** Monotonic version bumped when owner AI/knowledge/hours/integration config changes */
      assistantConfigVersion: { type: Number, default: 1 },
      assistantConfigVersionUpdatedAt: { type: Date },
      assistantConfigVersionReason: { type: String },
      /**
       * Per-workspace engine selector (overrides global AI_CONVERSATION_PIPELINE when set):
       * v2 | v3 | shadow | v1
       */
      assistantEngine: {
        type: String,
        enum: ['v1', 'v2', 'v3', 'shadow'],
        default: undefined,
      },
      enabledChannels: {
        liveChat: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        facebook: { type: Boolean, default: false },
        instagram: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
        tiktok: { type: Boolean, default: false },
      },
      channelOverrides: {
        liveChat: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
        email: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
        facebook: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
        instagram: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
        whatsapp: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
        tiktok: {
          instructions: { type: String },
          escalationKeywords: [{ type: String }],
          allowedActions: {
            lookupOrder: { type: Boolean },
            cancelOrder: { type: Boolean },
            refundOrder: { type: Boolean },
            maxRefundAmount: { type: Number },
            editOrder: { type: Boolean },
            productRecommendations: { type: Boolean },
            requestHuman: { type: Boolean },
          },
        },
      },
    },

    // Helpdesk AI (inbox overview, copilot, routing) — Settings → Helpdesk AI
    helpdeskAi: {
      overview: { type: Boolean, default: true },
      suggestedReply: { type: Boolean, default: true },
      replyTools: { type: Boolean, default: true },
      recommendedAction: { type: Boolean, default: true },
      riskDetection: { type: Boolean, default: true },
      autoTag: { type: Boolean, default: true },
      autoRouting: { type: Boolean, default: false },
      similarTickets: { type: Boolean, default: true },
      customerProfile: { type: Boolean, default: true },
      customerTimeline: { type: Boolean, default: true },
      contradictions: { type: Boolean, default: true },
      incidentDetection: { type: Boolean, default: true },
      mergeSuggestions: { type: Boolean, default: true },
      slaPrediction: { type: Boolean, default: true },
      resolutionCheck: { type: Boolean, default: true },
      qualityAssurance: { type: Boolean, default: true },
      agentCoaching: { type: Boolean, default: true },
      managerFeed: { type: Boolean, default: true },
      rootCauseAnalysis: { type: Boolean, default: true },
      churnRecovery: { type: Boolean, default: true },
      knowledgeGaps: { type: Boolean, default: true },
      draftArticles: { type: Boolean, default: true },
      outdatedKnowledge: { type: Boolean, default: true },
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
      whatsapp: {
        status: {
          type: String,
          enum: ['disconnected', 'pending', 'connected', 'error'],
          default: 'disconnected',
        },
        connectedAt: { type: Date },
        lastError: { type: String },
        wabaId: { type: String }, // WhatsApp Business Account id
        phoneNumberId: { type: String }, // Cloud API phone number id
        displayPhoneNumber: { type: String },
        verifiedName: { type: String },
        accessToken: { type: String, select: false },
      },
      email: {
        status: {
          type: String,
          enum: ['disconnected', 'connected', 'error'],
          default: 'disconnected',
        },
        provider: {
          type: String,
          enum: ['imap', 'google', 'microsoft'],
        },
        address: { type: String }, // the connected mailbox address
        displayName: { type: String }, // sender name shown to customers
        outboundVia: {
          type: String,
          enum: ['smtp', 'resend'],
          default: 'smtp',
        },
        connectedAt: { type: Date },
        lastSyncAt: { type: Date },
        lastError: { type: String },
        lastSeenUid: { type: Number }, // IMAP INBOX sync cursor
        imap: {
          host: { type: String },
          port: { type: Number },
          secure: { type: Boolean, default: true },
          user: { type: String },
          smtpHost: { type: String },
          smtpPort: { type: Number },
          smtpSecure: { type: Boolean, default: true },
        },
        // Encrypted secret bundle (IMAP/SMTP password, or OAuth tokens later)
        secret: { type: String, select: false },
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
