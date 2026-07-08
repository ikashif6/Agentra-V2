const DEFAULT_PRIMARY = '#D85A30';

function isValidHex(color) {
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color);
}

function getWorkspaceBranding(company) {
  const branding = company.branding || {};
  const primaryColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : DEFAULT_PRIMARY;

  return {
    logo: company.logo || null,
    primaryColor,
    theme: ['light', 'dark', 'system'].includes(branding.theme) ? branding.theme : 'light',
  };
}

async function updateWorkspaceBranding(company, body = {}) {
  if (!company.branding) {
    company.branding = {
      primaryColor: DEFAULT_PRIMARY,
      theme: 'light',
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

  company.markModified('branding');
  await company.save();

  return getWorkspaceBranding(company);
}

module.exports = {
  DEFAULT_PRIMARY,
  getWorkspaceBranding,
  updateWorkspaceBranding,
};
