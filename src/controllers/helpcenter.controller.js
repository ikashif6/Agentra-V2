const crypto = require('crypto');
const HelpCenter = require('../models/HelpCenter');
const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const response = require('../utils/apiResponse');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateVerificationToken() {
  return `agentraa-verify=${crypto.randomBytes(20).toString('hex')}`;
}

// ─── Owner / Admin: manage their help center ──────────────────────────────────

/**
 * GET /helpcenter/settings
 * Returns the company's help center config (or null if not yet set up).
 */
exports.getSettings = async (req, res, next) => {
  try {
    const helpCenter = await HelpCenter.findOne({ company: req.company._id })
      .select('+domainVerificationToken');

    return response.success(res, { helpCenter: helpCenter ?? null });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /helpcenter/settings
 * Create or update the help center configuration (upsert).
 *
 * Body: { layout, title, subtitle, primaryColor, features, isPublished }
 */
exports.saveSettings = async (req, res, next) => {
  try {
    const company = req.company;

    const allowed = ['layout', 'title', 'subtitle', 'primaryColor', 'features', 'isPublished', 'metaDescription', 'logoUrl'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const helpCenter = await HelpCenter.findOneAndUpdate(
      { company: company._id },
      {
        $set: {
          ...updates,
          company_subdomain: company.subdomain,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return response.success(res, { helpCenter }, 'Help center settings saved');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /helpcenter/domain
 * Connect a custom domain (e.g. help.acme.com).
 * Generates a DNS TXT verification token. The company must add a DNS TXT record:
 *   _agentraa-verify.help.acme.com  →  <token>
 * then call POST /helpcenter/domain/verify to confirm.
 *
 * Body: { domain }
 */
exports.connectDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return response.badRequest(res, 'domain is required');
    }

    const cleanDomain = domain.toLowerCase().trim();

    // Basic domain format check
    if (!/^[a-z0-9]([a-z0-9.-]{0,250}[a-z0-9])?$/.test(cleanDomain)) {
      return response.badRequest(res, 'Invalid domain format');
    }

    // Check if another company already uses this domain
    const taken = await HelpCenter.findOne({
      customDomain: cleanDomain,
      company: { $ne: req.company._id },
    });
    if (taken) {
      return response.conflict(res, 'This domain is already connected to another workspace');
    }

    const verificationToken = generateVerificationToken();

    const helpCenter = await HelpCenter.findOneAndUpdate(
      { company: req.company._id },
      {
        $set: {
          company_subdomain: req.company.subdomain,
          customDomain: cleanDomain,
          customDomainVerified: false,
          domainVerificationToken: verificationToken,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Mirror on Company doc for fast resolveTenant lookups
    await Company.findByIdAndUpdate(req.company._id, {
      $set: {
        'helpCenterDomain': cleanDomain,
        'helpCenterDomainVerified': false,
      },
    });

    return response.success(res, {
      domain: cleanDomain,
      verificationToken,
      instructions: {
        type: 'TXT',
        host: `_agentraa-verify.${cleanDomain}`,
        value: verificationToken,
        note: 'Add this TXT record to your DNS provider, then click Verify Domain. DNS changes can take up to 48 hours to propagate.',
      },
    }, 'Domain saved. Please add the TXT verification record to your DNS.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /helpcenter/domain/verify
 * Simulate DNS TXT verification.
 * In production this would do a real DNS TXT lookup.
 * For now it marks the domain as verified (DNS lookup is a TODO for prod).
 */
exports.verifyDomain = async (req, res, next) => {
  try {
    const helpCenter = await HelpCenter.findOne({ company: req.company._id })
      .select('+domainVerificationToken');

    if (!helpCenter || !helpCenter.customDomain) {
      return response.badRequest(res, 'No custom domain is pending verification');
    }

    if (helpCenter.customDomainVerified) {
      return response.success(res, { verified: true, domain: helpCenter.customDomain }, 'Domain is already verified');
    }

    // ── Production: real DNS TXT lookup ───────────────────────────────────────
    // const dns = require('dns').promises;
    // const txtHost = `_agentraa-verify.${helpCenter.customDomain}`;
    // let verified = false;
    // try {
    //   const records = await dns.resolveTxt(txtHost);
    //   verified = records.flat().includes(helpCenter.domainVerificationToken);
    // } catch { verified = false; }
    // if (!verified) return response.badRequest(res, 'DNS TXT record not found yet. Please wait for propagation and try again.');

    // ── Development: auto-verify ───────────────────────────────────────────────
    const verified = true; // TODO: replace with real DNS lookup in production

    if (!verified) {
      return response.badRequest(res, 'DNS TXT record not found. Check your DNS settings and try again.');
    }

    await HelpCenter.findOneAndUpdate(
      { company: req.company._id },
      { $set: { customDomainVerified: true } }
    );

    // Mirror verified state on Company doc
    await Company.findByIdAndUpdate(req.company._id, {
      $set: { 'helpCenterDomainVerified': true },
    });

    return response.success(res, {
      verified: true,
      domain: helpCenter.customDomain,
    }, `Domain ${helpCenter.customDomain} has been verified successfully!`);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /helpcenter/domain
 * Disconnect the custom domain.
 */
exports.disconnectDomain = async (req, res, next) => {
  try {
    await HelpCenter.findOneAndUpdate(
      { company: req.company._id },
      {
        $unset: {
          customDomain: 1,
          domainVerificationToken: 1,
        },
        $set: { customDomainVerified: false },
      }
    );

    await Company.findByIdAndUpdate(req.company._id, {
      $unset: { helpCenterDomain: 1, helpCenterDomainVerified: 1 },
    });

    return response.success(res, {}, 'Custom domain disconnected');
  } catch (err) {
    next(err);
  }
};

// ─── Public: Help Center Portal ───────────────────────────────────────────────

/**
 * GET /helpcenter/public
 * Returns the public-facing help center config for a given company.
 * The company is resolved by the resolveHelpCenter middleware, which looks at:
 *   1. Host header: help.acme.com → match HelpCenter.customDomain
 *   2. Subdomain pattern: help.lyca.agentraa.com → company_subdomain = 'lyca'
 *   3. x-helpcenter-subdomain header (for dev / API clients)
 *
 * No auth required.
 */
exports.getPublic = async (req, res, next) => {
  try {
    const helpCenter = req.helpCenter;

    if (!helpCenter || !helpCenter.isPublished) {
      return response.notFound(res, 'Help center not found or not published');
    }

    // helpCenter.company is the populated Company doc
    const company = req.helpCenterCompany;

    // Only return safe public fields
    const safe = {
      title: helpCenter.title,
      subtitle: helpCenter.subtitle,
      layout: helpCenter.layout,
      primaryColor: helpCenter.primaryColor,
      logoUrl: helpCenter.logoUrl,
      features: helpCenter.features,
      companyName: company?.name,
      subdomain: helpCenter.company_subdomain,
    };

    return response.success(res, { helpCenter: safe });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /helpcenter/public/contact
 * Submit a contact form OR raise a ticket — creates a ticket on behalf of the visitor.
 *
 * Body: { name, email, subject, message, priority?, type? }
 *   type = "contact"  (default) → gates on features.contactForm
 *   type = "ticket"             → gates on features.raiseTicket
 *
 * No auth required.
 */
exports.submitContactForm = async (req, res, next) => {
  try {
    const helpCenter = req.helpCenter;
    const company = req.helpCenterCompany;

    if (!helpCenter || !helpCenter.isPublished) {
      return response.notFound(res, 'Help center not found');
    }

    const submissionType = req.body.type === 'ticket' ? 'ticket' : 'contact';

    if (submissionType === 'contact' && !helpCenter.features?.contactForm) {
      return response.forbidden(res, 'Contact form is not enabled for this help center');
    }
    if (submissionType === 'ticket' && !helpCenter.features?.raiseTicket) {
      return response.forbidden(res, 'Ticket submission is not enabled for this help center');
    }

    const { name, email, subject, message, priority = 'medium' } = req.body;

    if (!name || !email || !subject || !message) {
      return response.badRequest(res, 'name, email, subject, and message are required');
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return response.badRequest(res, 'Invalid email address');
    }

    if (!company) {
      return response.error(res, 'Company context missing', 500);
    }

    const User = require('../models/User');

    // Find or create a guest user for this email in this company
    let guestUser = await User.findOne({ email: email.toLowerCase(), company: company._id });

    if (!guestUser) {
      const nameParts = name.trim().split(' ');
      guestUser = await User.create({
        firstName: nameParts[0] || name,
        lastName: nameParts.slice(1).join(' ') || 'Guest',
        email: email.toLowerCase(),
        company: company._id,
        role: 'customer',
        isEmailVerified: false,
      });

      // Update usage counter
      await Company.findByIdAndUpdate(company._id, { $inc: { 'usage.totalUsers': 1 } });
    }

    const prefix = company.settings?.ticketPrefix || 'TKT';
    const ticket_code = await Ticket.generateCode(company._id, prefix);

    const ticket = await Ticket.create({
      ticket_code,
      company: company._id,
      company_subdomain: company.subdomain,
      ticket_title: subject,
      ticket_description: message,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'open',
      createdBy: guestUser._id,
      peoples: [{ user: guestUser._id, role: 'customer' }],
      messages: [
        {
          sender: guestUser._id,
          senderEmail: email.toLowerCase(),
          body: message,
          isInternal: false,
        },
      ],
      lastActivity: new Date(),
    });

    await Company.findByIdAndUpdate(company._id, {
      $inc: { 'usage.totalTickets': 1, 'usage.openTickets': 1 },
    });

    return response.created(res, {
      ticket_code: ticket.ticket_code,
      message: 'Your message has been received. We will get back to you shortly.',
    }, 'Contact form submitted successfully');
  } catch (err) {
    next(err);
  }
};
