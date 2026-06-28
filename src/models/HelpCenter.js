const mongoose = require('mongoose');

/**
 * HelpCenter Model
 *
 * Each company can configure exactly one help center.
 * The help center is accessible at:
 *   - https://help.<subdomain>.agentraa.com  (default)
 *   - https://<customHelpDomain>             (if set and verified)
 *
 * When a request arrives at a custom domain like help.acme.com,
 * the resolveHelpDomain middleware finds the company by matching
 * company.helpCenter.customDomain === host.
 */
const helpCenterSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
    },

    // The subdomain is denormalised here for fast domain lookups
    company_subdomain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // ── Appearance ─────────────────────────────────────────────────────────────
    layout: {
      type: String,
      enum: ['classic', 'sidebar', 'cards'],
      default: 'classic',
    },

    // Basic branding
    title: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Help Center',
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 300,
      default: 'How can we help you?',
    },
    primaryColor: {
      type: String,
      default: '#E8470A',
    },
    logoUrl: { type: String },
    faviconUrl: { type: String },

    // ── Features ───────────────────────────────────────────────────────────────
    features: {
      // Show a contact form (sends a new ticket on submit)
      contactForm: { type: Boolean, default: true },
      // Allow logged-in / guest users to raise a support ticket directly
      raiseTicket: { type: Boolean, default: true },
      // Show a public ticket-tracking widget
      ticketTracking: { type: Boolean, default: true },
      // Show a search bar over articles (future: knowledge base)
      search: { type: Boolean, default: true },
    },

    // ── Custom domain ──────────────────────────────────────────────────────────
    // The company connects their own domain, e.g. help.acme.com
    // We save it here AND mirror it on the Company doc for quick lookups.
    customDomain: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true, // allows null, but must be unique when set
    },
    customDomainVerified: { type: Boolean, default: false },

    // DNS verification token — company adds a TXT record with this value
    domainVerificationToken: {
      type: String,
      select: false,
    },

    // ── Status ─────────────────────────────────────────────────────────────────
    isPublished: { type: Boolean, default: false },

    // ── SEO / meta ─────────────────────────────────────────────────────────────
    metaDescription: { type: String, maxlength: 300 },
    metaKeywords: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: public URL ────────────────────────────────────────────────────────
helpCenterSchema.virtual('publicUrl').get(function () {
  if (this.customDomain && this.customDomainVerified) {
    return `https://${this.customDomain}`;
  }
  const base = process.env.APP_BASE_DOMAIN || 'agentraa.com';
  return `https://help.${this.company_subdomain}.${base}`;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
helpCenterSchema.index({ company: 1 }, { unique: true });
helpCenterSchema.index({ company_subdomain: 1 });
helpCenterSchema.index({ customDomain: 1 }, { sparse: true });

module.exports = mongoose.model('HelpCenter', helpCenterSchema);
