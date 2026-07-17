const DEFAULT_PRIMARY = '#D85A30';
const DEFAULT_LOGO_WIDTH = 148;
const DEFAULT_LOGO_HEIGHT = 28;

function isValidHex(color) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color);
}

function clamp(n, min, max, fallback) {
  const value = Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function cleanText(value, max) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function getWorkspaceBranding(company) {
  const branding = company.branding || {};
  const primaryColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : DEFAULT_PRIMARY;

  return {
    logo: company.logo || null,
    logoDark: branding.logoDark || null,
    favicon: branding.favicon || null,
    browserTitle: branding.browserTitle || company.name || null,
    tagline: branding.tagline || null,
    logoWidth: clamp(branding.logoWidth, 24, 280, DEFAULT_LOGO_WIDTH),
    logoHeight: clamp(branding.logoHeight, 16, 120, DEFAULT_LOGO_HEIGHT),
    primaryColor,
    theme: ['light', 'dark', 'system'].includes(branding.theme) ? branding.theme : 'light',
  };
}

/** Compact company payload used by auth login/me and frontend AuthContext. */
function publicCompanyBranding(company) {
  if (!company) return null;
  const branding = getWorkspaceBranding(company);
  return {
    _id: company._id,
    id: company._id,
    name: company.name,
    subdomain: company.subdomain,
    timezone: company.timezone,
    logo: branding.logo,
    branding: {
      primaryColor: branding.primaryColor,
      theme: branding.theme,
      favicon: branding.favicon,
      logoDark: branding.logoDark,
      browserTitle: branding.browserTitle,
      tagline: branding.tagline,
      logoWidth: branding.logoWidth,
      logoHeight: branding.logoHeight,
    },
    plan: company.plan
      ? {
          name: company.plan.name,
          status: company.plan.status,
          trialEndsAt: company.plan.trialEndsAt,
          currentPeriodEnd: company.plan.currentPeriodEnd,
          cancelAtPeriodEnd: company.plan.cancelAtPeriodEnd,
          canceledAt: company.plan.canceledAt,
        }
      : undefined,
  };
}

async function updateWorkspaceBranding(company, body = {}) {
  if (!company.branding) {
    company.branding = {
      primaryColor: DEFAULT_PRIMARY,
      theme: 'light',
      logoWidth: DEFAULT_LOGO_WIDTH,
      logoHeight: DEFAULT_LOGO_HEIGHT,
    };
  }

  if (body.primaryColor !== undefined) {
    if (!isValidHex(body.primaryColor)) {
      const err = new Error('Primary color must be a valid hex value');
      err.statusCode = 400;
      throw err;
    }
    company.branding.primaryColor = body.primaryColor;
  }

  if (body.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(body.theme)) {
      const err = new Error('Theme must be light, dark, or system');
      err.statusCode = 400;
      throw err;
    }
    company.branding.theme = body.theme;
  }

  if (body.logo !== undefined) {
    company.logo = body.logo || undefined;
  }

  if (body.logoDark !== undefined) {
    company.branding.logoDark = body.logoDark || undefined;
  }

  if (body.favicon !== undefined) {
    company.branding.favicon = body.favicon || undefined;
  }

  if (body.browserTitle !== undefined) {
    company.branding.browserTitle = cleanText(body.browserTitle, 80) || undefined;
  }

  if (body.tagline !== undefined) {
    company.branding.tagline = cleanText(body.tagline, 160) || undefined;
  }

  if (body.logoWidth !== undefined) {
    company.branding.logoWidth = clamp(body.logoWidth, 24, 280, DEFAULT_LOGO_WIDTH);
  }

  if (body.logoHeight !== undefined) {
    company.branding.logoHeight = clamp(body.logoHeight, 16, 120, DEFAULT_LOGO_HEIGHT);
  }

  if (!company.setupChecklist) company.setupChecklist = {};
  company.setupChecklist.workspace = true;

  const checklist = company.setupChecklist;
  if (
    checklist.store
    && checklist.channels
    && checklist.ai
    && checklist.workspace
    && checklist.team
    && !checklist.completedAt
  ) {
    company.setupChecklist.completedAt = new Date();
  }

  company.markModified('branding');
  company.markModified('setupChecklist');
  await company.save();

  return getWorkspaceBranding(company);
}

module.exports = {
  DEFAULT_PRIMARY,
  DEFAULT_LOGO_WIDTH,
  DEFAULT_LOGO_HEIGHT,
  getWorkspaceBranding,
  publicCompanyBranding,
  updateWorkspaceBranding,
};
