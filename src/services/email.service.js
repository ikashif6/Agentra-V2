const { Resend } = require('resend');

// Lazy-initialised so the module can be required before env vars are loaded
let _resend = null;
const getResend = () => {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};

const FROM = () => `${process.env.RESEND_FROM_NAME || 'Agentra'} <${process.env.RESEND_FROM_EMAIL || 'noreply@agentraa.com'}>`;
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'agentraa.com';
const FRONTEND_URL = process.env.APP_FRONTEND_URL || 'https://app.agentraa.com';

const BRAND = {
  orange: '#D85A30',
  orangeDark: '#C44F2A',
  text: '#1A1D26',
  muted: '#5C6578',
  faint: '#8B93A7',
  border: '#E5E7EB',
  surface: '#F7F7F8',
  canvas: '#EEF0F3',
  callout: '#F7F3EE',
  calloutBorder: '#E8E0D5',
  link: '#D85A30',
  white: '#FFFFFF',
  linkedIn: '#0A66C2',
};

const LEGAL = {
  helpCenter: 'https://help.agentraa.com/',
  privacyPolicy: 'https://agentraa.com/privacy-policy/',
  termsAndConditions: 'https://agentraa.com/terms-conditions/',
  marketingSite: 'https://agentraa.com',
  linkedIn: 'https://www.linkedin.com/company/agentraa',
};

/** Plus Jakarta Sans with Trebuchet fallback (Gmail-safe). */
const FONT_HEADING =
  "'Plus Jakarta Sans', 'Trebuchet MS', 'Lucida Grande', Helvetica, Arial, sans-serif";
const FONT_BODY =
  "'Plus Jakarta Sans', 'Trebuchet MS', 'Lucida Grande', Helvetica, Arial, sans-serif";
const FONT = FONT_BODY;

const FONT_IMPORT =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";

const fs = require('fs');
const path = require('path');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildWorkspaceFrontendUrl(subdomain) {
  if (process.env.EMAIL_WORKSPACE_URL_TEMPLATE) {
    return process.env.EMAIL_WORKSPACE_URL_TEMPLATE.replace('{subdomain}', subdomain);
  }
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.APP_FRONTEND_DEV_PORT || '3000';
    return `http://${subdomain}.localhost:${port}`;
  }
  return `https://${subdomain}.${BASE_DOMAIN}`;
}

/** Verification links: in dev use root localhost (no DNS needed for *.agentraa.com). */
function buildVerifyEmailUrl(subdomain, token) {
  if (process.env.EMAIL_VERIFY_URL_TEMPLATE) {
    return process.env.EMAIL_VERIFY_URL_TEMPLATE.replace('{token}', token).replace('{subdomain}', subdomain);
  }
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.APP_FRONTEND_DEV_PORT || '3000';
    return `http://localhost:${port}/auth/verify-email?token=${token}`;
  }
  return `https://${subdomain}.${BASE_DOMAIN}/auth/verify-email?token=${token}`;
}

const LOGO_CID = 'agentra-logo';
const LOGO_WHITE_CID = 'agentra-logo-white';

const EMAIL_ICON_NAMES = [
  'shield',
  'mail',
  'key',
  'link',
  'lock',
  'users',
  'spark',
  'ticket',
  'help',
  'channel',
  'bot',
  'check',
];

function readLogoBuffer(relativePublicPath) {
  try {
    return fs.readFileSync(path.join(__dirname, '../../client/public', relativePublicPath));
  } catch {
    return null;
  }
}

function emailIconCid(name) {
  return `email-icon-${name}`;
}

function getEmailIconSrc(name) {
  return `cid:${emailIconCid(name)}`;
}

/** Preview: absolute URL or data URI for icons. */
function getEmailIconPreviewSrc(name, absoluteBase) {
  if (absoluteBase) {
    return `${String(absoluteBase).replace(/\/$/, '')}/${name}.png`;
  }
  const buf = readLogoBuffer(`email/icons/${name}.png`);
  if (buf) return `data:image/png;base64,${buf.toString('base64')}`;
  return getEmailIconSrc(name);
}

/**
 * Logo sources for HTML:
 * - EMAIL_LOGO_URL / EMAIL_LOGO_WHITE_URL if set (public HTTPS PNG — best for some clients)
 * - otherwise cid: inline attachments (Gmail blocks data-URI / SVG images)
 */
function getEmailLogoSrc({ white = false } = {}) {
  if (white && process.env.EMAIL_LOGO_WHITE_URL) return process.env.EMAIL_LOGO_WHITE_URL;
  if (!white && process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;
  return white ? `cid:${LOGO_WHITE_CID}` : `cid:${LOGO_CID}`;
}

/** Preview / local UI: serveable file URL or data URI (not for Gmail sends). */
function getEmailLogoPreviewSrc({ white = false, absoluteBase } = {}) {
  if (absoluteBase) {
    const file = white ? 'agentra-logo-white.png' : 'agentra-logo.png';
    return `${String(absoluteBase).replace(/\/$/, '')}/${file}`;
  }
  const relative = white ? 'email/agentra-logo-white.png' : 'email/agentra-logo.png';
  const buf = readLogoBuffer(relative);
  if (buf) return `data:image/png;base64,${buf.toString('base64')}`;
  return getEmailLogoSrc({ white });
}

function buildLogoAttachments(html = '') {
  const attachments = [];
  if (html.includes(`cid:${LOGO_CID}`)) {
    const content = readLogoBuffer('email/agentra-logo.png');
    if (content) {
      attachments.push({
        filename: 'agentra-logo.png',
        content,
        contentType: 'image/png',
        contentId: LOGO_CID,
      });
    }
  }
  if (html.includes(`cid:${LOGO_WHITE_CID}`)) {
    const content = readLogoBuffer('email/agentra-logo-white.png');
    if (content) {
      attachments.push({
        filename: 'agentra-logo-white.png',
        content,
        contentType: 'image/png',
        contentId: LOGO_WHITE_CID,
      });
    }
  }
  for (const name of EMAIL_ICON_NAMES) {
    const cid = emailIconCid(name);
    if (!html.includes(`cid:${cid}`)) continue;
    const content = readLogoBuffer(`email/icons/${name}.png`);
    if (!content) continue;
    attachments.push({
      filename: `${name}.png`,
      content,
      contentType: 'image/png',
      contentId: cid,
    });
  }
  return attachments;
}

function emailButton(href, label, background = BRAND.orange) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0 16px;width:100%;">
      <tr>
        <td width="100%" style="width:100%;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:48px;v-text-anchor:middle;width:520px;" arcsize="12%" stroke="f" fillcolor="${background}">
            <center style="color:${BRAND.white};font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${escapeHtml(label)}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${href}"
             style="display:block;width:100%;box-sizing:border-box;background-color:${background};color:${BRAND.white};padding:15px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;line-height:1.25;text-align:center;font-family:${FONT_BODY};mso-hide:all;">
            ${escapeHtml(label)}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function emailNotice(html) {
  return `<p style="margin:0 0 28px;color:${BRAND.faint};font-size:13px;line-height:1.55;font-family:${FONT_BODY};">* ${html}</p>`;
}

function emailHeroIcon(name, alt = '') {
  const src = getEmailIconSrc(name);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
      <tr>
        <td>
          <img src="${src}" alt="${escapeHtml(alt)}" width="40" height="40" style="display:block;width:40px;height:40px;border:0;" />
        </td>
      </tr>
    </table>`;
}

function emailSteps(items = []) {
  if (!items.length) return '';
  const rows = items
    .map(
      (item, index) => `
      <tr>
        <td style="padding:0 0 ${index === items.length - 1 ? '0' : '10px'};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;background-color:${BRAND.surface};border-radius:10px;">
            <tr>
              <td style="padding:14px 16px;vertical-align:middle;width:36px;">
                <div style="width:28px;height:28px;border-radius:8px;background-color:${BRAND.orange};color:${BRAND.white};font-size:13px;font-weight:700;line-height:28px;text-align:center;font-family:${FONT_BODY};">
                  ${index + 1}
                </div>
              </td>
              <td style="padding:14px 16px 14px 0;vertical-align:middle;color:${BRAND.text};font-size:15px;font-weight:500;line-height:1.45;font-family:${FONT_BODY};">
                ${item}
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 24px;width:100%;">
      ${rows}
    </table>`;
}

/** Netflix-style icon + title + description rows */
function emailFeatureList(features = []) {
  if (!features.length) return '';
  const rows = features
    .map(({ icon, title, body }) => {
      const src = getEmailIconSrc(icon);
      return `
      <tr>
        <td style="padding:0 0 20px;vertical-align:top;width:44px;">
          <img src="${src}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border:0;" />
        </td>
        <td style="padding:0 0 20px 12px;vertical-align:top;font-family:${FONT_BODY};">
          <p style="margin:0 0 4px;color:${BRAND.text};font-size:15px;font-weight:700;line-height:1.3;">${escapeHtml(title)}</p>
          <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.5;">${body}</p>
        </td>
      </tr>`;
    })
    .join('');
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 8px;">
      ${rows}
    </table>`;
}

/** Zapier-style light disclaimer / tip box */
function emailCallout(title, bodyHtml) {
  const titleHtml = title
    ? `<p style="margin:0 0 6px;color:${BRAND.text};font-size:14px;font-weight:600;font-family:${FONT_BODY};">${escapeHtml(title)}</p>`
    : '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 0;">
      <tr>
        <td style="background:${BRAND.callout};border:1px solid ${BRAND.calloutBorder};border-radius:8px;padding:16px 18px;">
          ${titleHtml}
          <div style="color:${BRAND.muted};font-size:14px;line-height:1.55;font-family:${FONT_BODY};">
            ${bodyHtml}
        </div>
        </td>
      </tr>
    </table>`;
}

function emailCodeBlock(code) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 16px;">
      <tr>
        <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;padding:18px 22px;">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.text};font-family:'Courier New',Courier,monospace;line-height:1;">
            ${escapeHtml(code)}
          </span>
        </td>
      </tr>
    </table>`;
}

function emailHeading(title) {
  return `<h1 style="margin:0 0 20px;color:${BRAND.text};font-size:32px;line-height:1.25;font-weight:700;font-family:${FONT_HEADING};">${title}</h1>`;
}

function emailParagraph(html, { muted = false, size = 16 } = {}) {
  return `<p style="margin:0 0 18px;color:${muted ? BRAND.muted : BRAND.text};font-size:${size}px;line-height:1.65;font-family:${FONT_BODY};">${html}</p>`;
}

/** Netflix-style secondary section (security tip / help). */
function emailSection(title, bodyHtml) {
  return `
    <div style="margin:32px 0 0;">
      <p style="margin:0 0 10px;color:${BRAND.text};font-size:15px;font-weight:700;font-family:${FONT_BODY};">${escapeHtml(title)}</p>
      <div style="color:${BRAND.text};font-size:15px;line-height:1.65;font-family:${FONT_BODY};">
        ${bodyHtml}
      </div>
    </div>`;
}

function emailSignOff() {
  return `<p style="margin:36px 0 0;color:${BRAND.text};font-size:15px;line-height:1.6;font-family:${FONT_BODY};">The <strong>Agentra</strong> team</p>`;
}

/** Classic LinkedIn “in” mark — square, brand blue (not circular). */
function emailLinkedInIcon() {
  return `
    <a href="${LEGAL.linkedIn}" target="_blank" rel="noopener" title="Agentra on LinkedIn"
       style="display:inline-block;width:28px;height:28px;background-color:#1A1D26;border-radius:2px;color:#FFFFFF;text-align:center;line-height:28px;font-weight:700;font-size:14px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
      in
    </a>`;
}

/**
 * Agentra product email shell (auth, billing, workspace invites).
 * Gray canvas + white card; Agentra logo, legal links, LinkedIn.
 */
function emailShell(input) {
  const options =
    typeof input === 'string'
      ? { bodyHtml: input }
      : input && typeof input === 'object'
        ? input
        : { bodyHtml: '' };

  const {
    title = 'Agentra',
    preheader = '',
    bodyHtml = '',
    logoSrc: logoOverride,
    footerNote = '',
  } = options;

  const logoSrc = logoOverride || getEmailLogoSrc();
  const year = new Date().getFullYear();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : '';

  return buildEmailDocument({
    title,
    preheaderHtml,
    bodyHtml,
    headerHtml: `
      <a href="${LEGAL.marketingSite}" style="text-decoration:none;display:inline-block;line-height:0;">
        <img src="${logoSrc}" alt="Agentra" width="132" height="30" style="display:block;width:132px;max-width:132px;height:auto;border:0;outline:none;" />
      </a>`,
    footerBrandHtml: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td valign="middle" bgcolor="${BRAND.white}" style="background-color:${BRAND.white};">
            <a href="${LEGAL.marketingSite}" style="text-decoration:none;display:inline-block;line-height:0;">
              <img src="${logoSrc}" alt="Agentra" width="100" height="23" style="display:block;width:100px;max-width:100px;height:auto;border:0;" />
            </a>
          </td>
          <td valign="middle" align="right" bgcolor="${BRAND.white}" style="background-color:${BRAND.white};">
            ${emailLinkedInIcon()}
          </td>
        </tr>
      </table>`,
    footerLinksHtml: `
      <a href="${LEGAL.termsAndConditions}" style="color:${BRAND.faint};text-decoration:underline;">Terms &amp; Conditions</a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${LEGAL.privacyPolicy}" style="color:${BRAND.faint};text-decoration:underline;">Privacy Policy</a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${LEGAL.helpCenter}" style="color:${BRAND.faint};text-decoration:underline;">Help Center</a>`,
    footerNoteHtml: footerNote
      ? `<p style="margin:0 0 12px;">${footerNote}</p>`
      : `<p style="margin:0 0 12px;">You received this email because you have an Agentra account.</p>`,
    copyrightHtml: `<p style="margin:0;">© ${year} Agentra Technologies (Private) Limited. All rights reserved.</p>`,
  });
}

/**
 * Merchant / customer-facing email shell (chat transcripts, ticket updates, etc.).
 * Uses the workspace brand — no Agentra logo, legal links, or LinkedIn.
 */
function merchantEmailShell({
  title = 'Support',
  preheader = '',
  bodyHtml = '',
  brandName = 'Support',
  logoUrl = '',
  websiteUrl = '',
  footerNote = '',
} = {}) {
  const year = new Date().getFullYear();
  const name = String(brandName || 'Support').trim() || 'Support';
  const site = String(websiteUrl || '').trim();
  const logo = String(logoUrl || '').trim();
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : '';

  const logoImg = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" style="display:block;max-height:36px;max-width:180px;width:auto;height:auto;border:0;outline:none;" />`
    : `<span style="display:inline-block;color:${BRAND.text};font-size:20px;font-weight:700;line-height:1.2;font-family:${FONT_HEADING};">${escapeHtml(name)}</span>`;

  const headerInner = site
    ? `<a href="${escapeHtml(site)}" style="text-decoration:none;display:inline-block;line-height:0;color:${BRAND.text};">${logoImg}</a>`
    : `<div style="display:inline-block;line-height:0;">${logoImg}</div>`;

  const footerLogo = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" style="display:block;max-height:28px;max-width:140px;width:auto;height:auto;border:0;" />`
    : `<span style="color:${BRAND.text};font-size:14px;font-weight:700;font-family:${FONT_BODY};">${escapeHtml(name)}</span>`;

  const footerBrand = site
    ? `<a href="${escapeHtml(site)}" style="text-decoration:none;display:inline-block;line-height:0;color:${BRAND.text};">${footerLogo}</a>`
    : footerLogo;

  return buildEmailDocument({
    title,
    preheaderHtml,
    bodyHtml,
    headerHtml: headerInner,
    footerBrandHtml: footerBrand,
    footerLinksHtml: site
      ? `<a href="${escapeHtml(site)}" style="color:${BRAND.faint};text-decoration:underline;">Visit our website</a>`
      : '',
    footerNoteHtml: footerNote
      ? `<p style="margin:0 0 12px;">${footerNote}</p>`
      : `<p style="margin:0 0 12px;">You received this email because you contacted ${escapeHtml(name)} support.</p>`,
    copyrightHtml: `<p style="margin:0;">© ${year} ${escapeHtml(name)}. All rights reserved.</p>`,
  });
}

function buildEmailDocument({
  title,
  preheaderHtml,
  bodyHtml,
  headerHtml,
  footerBrandHtml,
  footerLinksHtml,
  footerNoteHtml,
  copyrightHtml,
}) {
  const footerLinksRow = footerLinksHtml
    ? `<tr>
            <td bgcolor="${BRAND.white}" style="padding:8px 40px 16px;font-family:${FONT_BODY};font-size:12px;line-height:1.8;color:${BRAND.faint};background-color:${BRAND.white};">
              ${footerLinksHtml}
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(title)}</title>
  <!--[if !mso]><!-->
  <link href="${FONT_IMPORT}" rel="stylesheet" type="text/css" />
  <!--<![endif]-->
  <style type="text/css">
    :root { color-scheme: light only; supported-color-schemes: light only; }
    @import url('${FONT_IMPORT}');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body, .email-bg { background-color: ${BRAND.canvas} !important; }
    .email-card, .email-card td { background-color: ${BRAND.white} !important; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: ${BRAND.canvas} !important; }
      .email-card, .email-card td { background-color: ${BRAND.white} !important; color: ${BRAND.text} !important; }
    }
  </style>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:${BRAND.canvas};font-family:${FONT_BODY};">
  ${preheaderHtml}
  <table role="presentation" class="email-bg" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${BRAND.canvas}" style="background-color:${BRAND.canvas};">
    <tr>
      <td align="center" class="email-bg" bgcolor="${BRAND.canvas}" style="padding:32px 16px;background-color:${BRAND.canvas};">
        <table role="presentation" class="email-card" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${BRAND.white}" style="max-width:600px;width:100%;background-color:${BRAND.white};">
          <tr>
            <td bgcolor="${BRAND.white}" style="padding:40px 40px 24px;background-color:${BRAND.white};">
              ${headerHtml}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND.white}" style="padding:8px 40px 40px;font-family:${FONT_BODY};color:${BRAND.text};background-color:${BRAND.white};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND.white}" style="padding:8px 40px 0;background-color:${BRAND.white};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND.white}" style="padding:28px 40px 14px;background-color:${BRAND.white};">
              ${footerBrandHtml}
            </td>
          </tr>
          ${footerLinksRow}
          <tr>
            <td bgcolor="${BRAND.white}" style="padding:4px 40px 40px;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${BRAND.faint};background-color:${BRAND.white};">
              ${footerNoteHtml}
              ${copyrightHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Core send helper — wraps Resend and logs in dev.
 * Attaches inline CID logos when the HTML references them (required for Gmail).
 */
async function sendEmail({ to, subject, html, text, attachments: extraAttachments = [] }) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📧 [EMAIL] To: ${to} | Subject: ${subject}`);
    if (text) console.log(text);
    console.log('---');
  }

  const attachments = [...buildLogoAttachments(html), ...extraAttachments];

  const { data, error } = await getResend().emails.send({
    from: FROM(),
    to,
    subject,
    html,
    text,
    ...(attachments.length ? { attachments } : {}),
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function displayFirstName(user) {
  const name = String(user?.firstName || '').trim();
  return name || 'there';
}

/**
 * Send email verification link
 */
async function sendEmailVerification({ user, token, subdomain }) {
  const verifyUrl = buildVerifyEmailUrl(subdomain, token);
  const workspaceHost = `${subdomain}.${BASE_DOMAIN}`;
  const firstName = displayFirstName(user);

  await sendEmail({
    to: user.email,
    subject: 'Verify your Agentra email address',
    text: `Hi ${firstName},\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nYour workspace will be at ${workspaceHost}.\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, you can ignore this email.`,
    html: emailShell({
      title: 'Verify your email address',
      preheader: 'One quick tap and your Agentra workspace is ready to go.',
      bodyHtml: `
        ${emailHeading('Let’s get you verified')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `Welcome to <strong>Agentra</strong>! Confirm this email so we can unlock your workspace at <strong>${escapeHtml(workspaceHost)}</strong> and get your helpdesk humming.`,
        )}
        ${emailButton(verifyUrl, 'Verify email address')}
        ${emailNotice('This link expires after 24 hours and can only be used once.')}
        ${emailSection(
          'Keep your account secure:',
          `Only verify if you meant to create this account. Didn’t sign up? You can safely ignore this email.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Questions? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send magic link (passwordless login)
 */
async function sendMagicLink({ user, token, subdomain }) {
  const companyUrl = subdomain ? `https://${subdomain}.${BASE_DOMAIN}` : FRONTEND_URL;
  const magicUrl = `${companyUrl}/auth/magic-link?token=${token}`;
  const expiresMinutes = process.env.MAGIC_LINK_EXPIRES_MINUTES || 15;
  const firstName = displayFirstName(user);

  await sendEmail({
    to: user.email,
    subject: 'Your Agentra sign-in link',
    text: `Hi ${firstName},\n\nClick this link to sign in to Agentra:\n${magicUrl}\n\nThis link expires in ${expiresMinutes} minutes and can only be used once.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell({
      title: 'Your sign-in link',
      preheader: `Your one-tap Agentra sign-in link (expires in ${expiresMinutes} minutes).`,
      bodyHtml: `
        ${emailHeading('Your sign-in link is ready')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `Tap below to jump straight into <strong>Agentra</strong>. No password typing required this time.`,
        )}
        ${emailButton(magicUrl, 'Sign in to Agentra')}
        ${emailNotice(`This link expires after ${expiresMinutes} minutes and can only be used once.`)}
        ${emailSection(
          'Keep your account secure:',
          `If you didn’t ask for this link, ignore this email. Your account stays locked up tight.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Need a hand? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send OTP code (passwordless login)
 */
async function sendOtpCode({ user, otp, subdomain }) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const firstName = displayFirstName(user);

  await sendEmail({
    to: user.email,
    subject: `${otp} is your Agentra verification code`,
    text: `Hi ${firstName},\n\nYour Agentra verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell({
      title: 'Your verification code',
      preheader: `${otp} is your Agentra code. It expires in ${expiresMinutes} minutes.`,
      bodyHtml: `
        ${emailHeading('Your temporary access code')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `Use this code to finish signing in to <strong>Agentra</strong>. Enter it on the screen where you started and we’ll take it from there.`,
        )}
        ${emailCodeBlock(otp)}
        ${emailNotice(`This code expires after ${expiresMinutes} minutes.`)}
        ${emailSection(
          'Keep your account secure:',
          `Never share this code. Agentra will never ask for it by phone or chat.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Didn’t request this? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send 2FA email OTP (login challenge, enable, or disable).
 */
async function sendTwoFactorOtp({ user, otp, subdomain, purpose = '2fa_login' }) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const firstName = displayFirstName(user);
  const workspace = subdomain ? `${subdomain}.${BASE_DOMAIN}` : 'your Agentra workspace';

  const copy = {
    '2fa_login': {
      subject: `${otp} is your Agentra sign-in code`,
      title: 'Confirm it’s you',
      heading: 'Two-factor verification',
      lead: `You’re signing in to <strong>${escapeHtml(workspace)}</strong>. Enter this code to finish.`,
    },
    '2fa_enable': {
      subject: `${otp} — turn on two-factor authentication`,
      title: 'Enable two-factor authentication',
      heading: 'Confirm to turn on 2FA',
      lead: `You’re enabling email two-factor authentication on <strong>${escapeHtml(workspace)}</strong>. Enter this code to confirm.`,
    },
    '2fa_disable': {
      subject: `${otp} — turn off two-factor authentication`,
      title: 'Disable two-factor authentication',
      heading: 'Confirm to turn off 2FA',
      lead: `You’re turning off email two-factor authentication on <strong>${escapeHtml(workspace)}</strong>. Enter this code to confirm.`,
    },
  }[purpose] || {
    subject: `${otp} is your Agentra verification code`,
    title: 'Your verification code',
    heading: 'Your verification code',
    lead: `Use this code to continue on <strong>${escapeHtml(workspace)}</strong>.`,
  };

  await sendEmail({
    to: user.email,
    subject: copy.subject,
    text: `Hi ${firstName},\n\n${otp} is your Agentra verification code.\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, secure your account and contact support.`,
    html: emailShell({
      title: copy.title,
      preheader: `${otp} expires in ${expiresMinutes} minutes.`,
      bodyHtml: `
        ${emailHeading(copy.heading)}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(copy.lead)}
        ${emailCodeBlock(otp)}
        ${emailNotice(`This code expires after ${expiresMinutes} minutes.`)}
        ${emailSection(
          'Keep your account secure:',
          `Never share this code. Agentra will never ask for it by phone or chat.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Didn’t request this? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send password reset link
 */
async function sendPasswordReset({ user, token, subdomain }) {
  const companyUrl = subdomain ? `https://${subdomain}.${BASE_DOMAIN}` : FRONTEND_URL;
  const resetUrl = `${companyUrl}/auth/reset-password?token=${token}`;
  const firstName = displayFirstName(user);

  await sendEmail({
    to: user.email,
    subject: 'Reset your Agentra password',
    text: `Hi ${firstName},\n\nReset your password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, please ignore this email.`,
    html: emailShell({
      title: 'Reset your password',
      preheader: 'Choose a fresh password for your Agentra account.',
      bodyHtml: `
        ${emailHeading('Reset your password')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `Someone (hopefully you!) asked to reset the password for your <strong>Agentra</strong> account. Tap below to pick a new one and get back to supporting customers.`,
        )}
        ${emailButton(resetUrl, 'Reset your password')}
        ${emailNotice('This link expires after 1 hour and can only be used once.')}
        ${emailSection(
          'Keep your account secure:',
          `If you didn’t request this, you can ignore this email. Your current password still works.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Something look off? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send welcome email after company registration
 */
async function sendWelcomeEmail({ user, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/dashboard`;
  const firstName = displayFirstName(user);

  await sendEmail({
    to: user.email,
    subject: `Welcome to Agentra: ${company.name} workspace is ready`,
    text: `Hi ${firstName},\n\nWelcome to Agentra! Your workspace for ${company.name} is ready.\n\nAccess your dashboard: ${dashboardUrl}\n\nYour subdomain: ${company.subdomain}.${BASE_DOMAIN}\n\nGet started by inviting your team and creating your first ticket.`,
    html: emailShell({
      title: 'Welcome to Agentra',
      preheader: `Your ${company.name} workspace is live. Let’s make support feel easy.`,
      bodyHtml: `
        ${emailHeading(`You’re in, ${escapeHtml(firstName)}`)}
        ${emailParagraph(
          `Your <strong>${escapeHtml(company.name)}</strong> workspace on <strong>Agentra</strong> is ready. Inbox, AI agent, and team tools, all in one place.`,
        )}
        ${emailButton(dashboardUrl, 'Open your dashboard')}
        ${emailNotice(
          `Workspace URL: <a href="${dashboardUrl}" style="color:${BRAND.link};text-decoration:underline;">${escapeHtml(company.subdomain)}.${escapeHtml(BASE_DOMAIN)}</a>`,
        )}
        ${emailParagraph('<strong>A few ways to get going:</strong>')}
        ${emailSteps([
          'Invite your teammates',
          'Connect your support channels',
          'Tune your AI agent and helpdesk',
        ])}
        ${emailSection(
          'We’re here to help',
          `Stuck on setup? The <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a> has your back.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send workspace invite (owner/admin inviting a new agent/admin)
 */
async function sendTeamInviteByOwner({ user, token, company, inviter }) {
  const BASE = process.env.APP_BASE_DOMAIN || 'agentraa.com';
  const acceptUrl = `https://${company.subdomain}.${BASE}/auth/accept-invite?token=${token}`;
  const firstName = displayFirstName(user);
  const inviterName = `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'A teammate';

  await sendEmail({
    to: user.email,
    subject: `${inviter.firstName || 'Someone'} invited you to join ${company.name} on Agentra`,
    text: `Hi ${firstName},\n\n${inviterName} has invited you to join ${company.name} as a ${user.role}.\n\nAccept your invite: ${acceptUrl}\n\nThis link expires in 7 days.`,
    html: emailShell({
      title: "You're invited",
      preheader: `${inviterName} invited you to ${company.name} on Agentra.`,
      bodyHtml: `
        ${emailHeading('You’ve been invited to Agentra')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `<strong>${escapeHtml(inviterName)}</strong> wants you on the <strong>${escapeHtml(company.name)}</strong> workspace as a <strong>${escapeHtml(user.role)}</strong>. Accept below and you’re part of the crew.`,
        )}
        ${emailButton(acceptUrl, 'Accept invitation')}
        ${emailNotice('This invite link expires after 7 days.')}
        ${emailSection(
          'Keep your account secure:',
          `Wasn’t expecting this? Ignore the email. Nothing changes until you accept.`,
        )}
        ${emailSection(
          'We’re here to help',
          `Questions about roles or access? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send team membership invite notification
 */
async function sendTeamInvite({ invitee, inviter, team, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/teams/${team._id}`;
  const firstName = displayFirstName(invitee);
  const inviterName = `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || 'A teammate';

  await sendEmail({
    to: invitee.email,
    subject: `You've been added to the ${team.name} team on Agentra`,
    text: `Hi ${firstName},\n\n${inviterName} has added you to the "${team.name}" team at ${company.name}.\n\nView the team: ${dashboardUrl}\n\nIf you think this was a mistake, please contact your workspace admin.`,
    html: emailShell({
      title: "You've been added to a team",
      preheader: `You’re now on ${team.name} at ${company.name}.`,
      bodyHtml: `
        ${emailHeading('You’re on a new team')}
        ${emailParagraph(`Hi ${escapeHtml(firstName)},`)}
        ${emailParagraph(
          `<strong>${escapeHtml(inviterName)}</strong> added you to <strong>${escapeHtml(team.name)}</strong> at <strong>${escapeHtml(company.name)}</strong>. Jump in and say hello.`,
        )}
        ${emailButton(dashboardUrl, 'View your team')}
        ${emailSection(
          'We’re here to help',
          `Looks unexpected? Ping your workspace admin, or visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send OTP for ticket tracking (unauthenticated customer flow)
 */
async function sendTicketTrackOtp({ email, firstName, otp, ticket_code, subdomain }) {
  const expiresMinutes = process.env.TRACK_OTP_EXPIRES_MINUTES || 10;
  const name = String(firstName || '').trim() || 'there';

  await sendEmail({
    to: email,
    subject: `${otp} is your Agentra ticket tracking code`,
    text: `Hi ${name},\n\nYour one-time code to track ticket ${ticket_code} is:\n\n${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell({
      title: 'Track your ticket',
      preheader: `Your code for ticket ${ticket_code} is ready.`,
      bodyHtml: `
        ${emailHeading('Your ticket tracking code')}
        ${emailParagraph(`Hi ${escapeHtml(name)},`)}
        ${emailParagraph(
          `Here’s your one-time code for ticket <strong>${escapeHtml(ticket_code)}</strong>. Enter it to check the latest updates.`,
        )}
        ${emailCodeBlock(otp)}
        ${emailNotice(`This code expires after ${expiresMinutes} minutes.`)}
        ${emailSection(
          'Keep things secure:',
          `Didn’t ask for this code? You can ignore this email.`,
        )}
        ${emailSignOff()}
      `,
    }),
  });
}

/**
 * Send a support-ticket reply when direct SMTP is unavailable (e.g. Railway Hobby).
 * Uses Resend over HTTPS; sets Reply-To to the connected mailbox so customer replies
 * still land in IMAP.
 */
async function sendChannelReplyViaResend({
  displayName,
  fromAddress,
  to,
  subject,
  html,
  text,
  headers = {},
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured for outbound email relay');
  }

  const relayEmail = process.env.RESEND_FROM_EMAIL || 'noreply@agentraa.com';
  const relayName = displayName || process.env.RESEND_FROM_NAME || 'Support';

  const { data, error } = await getResend().emails.send({
    from: `${relayName} <${relayEmail}>`,
    to,
    replyTo: fromAddress,
    subject,
    html,
    text,
    headers: Object.keys(headers).length ? headers : undefined,
  });

  if (error) {
    console.error('Resend channel reply error:', error);
    throw new Error(`Failed to send reply: ${error.message}`);
  }

  const domain = relayEmail.split('@')[1] || 'agentraa.com';
  return {
    messageId: data?.id ? `<${data.id}@${domain}>` : undefined,
  };
}

module.exports = {
  BRAND,
  LEGAL,
  FONT,
  FONT_BODY,
  FONT_HEADING,
  FONT_IMPORT,
  LOGO_CID,
  LOGO_WHITE_CID,
  sendEmail,
  emailShell,
  merchantEmailShell,
  emailButton,
  emailNotice,
  emailSteps,
  emailCallout,
  emailCodeBlock,
  emailHeading,
  emailParagraph,
  emailSection,
  emailSignOff,
  escapeHtml,
  getEmailLogoSrc,
  getEmailLogoPreviewSrc,
  buildLogoAttachments,
  sendEmailVerification,
  sendMagicLink,
  sendOtpCode,
  sendTwoFactorOtp,
  sendPasswordReset,
  sendWelcomeEmail,
  sendTicketTrackOtp,
  sendTeamInvite,
  sendTeamInviteByOwner,
  sendChannelReplyViaResend,
};
