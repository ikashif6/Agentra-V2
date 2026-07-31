/**
 * Local Agentra email template preview + font picker.
 * Run: node ops/email-preview/serve.js
 * Open: http://localhost:5055
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  BRAND,
  LEGAL,
  FONT_BODY,
  FONT_HEADING,
  FONT_IMPORT,
  emailShell,
  emailHeading,
  emailParagraph,
  emailButton,
  emailCodeBlock,
  emailSteps,
  emailNotice,
  emailSection,
  emailSignOff,
  escapeHtml,
  getEmailLogoPreviewSrc,
} = require('../../src/services/email.service');

const PORT = Number(process.env.EMAIL_PREVIEW_PORT || 5055);
const LOGO_DIR = path.join(__dirname, '../../client/public/email');

const FONT_OPTIONS = [
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    role: 'sans',
    stack: "'Plus Jakarta Sans', 'Trebuchet MS', 'Lucida Grande', Helvetica, Arial, sans-serif",
    google: 'Plus+Jakarta+Sans:wght@400;500;600;700',
    note: 'Primary email font.',
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS (email-safe)',
    role: 'sans',
    stack: "'Trebuchet MS', 'Lucida Grande', Helvetica, Arial, sans-serif",
    google: null,
    note: 'Fallback used in Gmail.',
  },
];

function findFont(id) {
  return FONT_OPTIONS.find((f) => f.id === id) || null;
}

function googleImportFor(headingId, bodyId) {
  const families = [];
  for (const id of [headingId, bodyId]) {
    const f = findFont(id);
    if (f?.google) families.push(`family=${f.google}`);
  }
  if (!families.length) return '';
  return `https://fonts.googleapis.com/css2?${[...new Set(families)].join('&')}&display=swap`;
}

function applyFonts(html, headingId, bodyId) {
  const heading = findFont(headingId)?.stack || FONT_HEADING;
  const body = findFont(bodyId)?.stack || FONT_BODY;
  const importUrl = googleImportFor(headingId, bodyId) || FONT_IMPORT;
  return html
    .split(FONT_HEADING)
    .join(heading)
    .split(FONT_BODY)
    .join(body)
    .split(FONT_IMPORT)
    .join(importUrl || FONT_IMPORT);
}

function withPreviewLogos(html) {
  const color = getEmailLogoPreviewSrc({ absoluteBase: `http://127.0.0.1:${PORT}/logos` });
  return html.split('cid:agentra-logo-white').join(color).split('cid:agentra-logo').join(color);
}

function buildTemplate(id) {
  const verifyUrl = 'https://acme.agentraa.com/auth/verify-email?token=preview';
  const resetUrl = 'https://demo.agentraa.com/auth/reset-password?token=preview';
  const magicUrl = 'https://demo.agentraa.com/auth/magic-link?token=preview';
  const dashUrl = 'https://acme.agentraa.com/dashboard';

  const templates = {
    verification: {
      label: 'Email verification',
      html: emailShell({
        title: 'Verify your email address',
        bodyHtml: [
          emailHeading('Let’s get you verified'),
          emailParagraph('Hi Kashif,'),
          emailParagraph(
            'Welcome to <strong>Agentra</strong>! Confirm this email so we can unlock your workspace at <strong>acme.agentraa.com</strong> and get your helpdesk humming.',
          ),
          emailButton(verifyUrl, 'Verify email address'),
          emailNotice('This link expires after 24 hours and can only be used once.'),
          emailSection(
            'Keep your account secure:',
            'Only verify if you meant to create this account. Didn’t sign up? You can safely ignore this email.',
          ),
          emailSection(
            'We’re here to help',
            `Questions? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
    reset: {
      label: 'Password reset',
      html: emailShell({
        title: 'Reset your password',
        bodyHtml: [
          emailHeading('Reset your password'),
          emailParagraph('Hi Kashif,'),
          emailParagraph(
            'Someone (hopefully you!) asked to reset the password for your <strong>Agentra</strong> account. Tap below to pick a new one and get back to supporting customers.',
          ),
          emailButton(resetUrl, 'Reset your password'),
          emailNotice('This link expires after 1 hour and can only be used once.'),
          emailSection(
            'Keep your account secure:',
            'If you didn’t request this, you can ignore this email. Your current password still works.',
          ),
          emailSection(
            'We’re here to help',
            `Something look off? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
    otp: {
      label: 'Login OTP',
      html: emailShell({
        title: 'Your verification code',
        bodyHtml: [
          emailHeading('Your temporary access code'),
          emailParagraph('Hi Kashif,'),
          emailParagraph(
            'Use this code to finish signing in to <strong>Agentra</strong>. Enter it on the screen where you started and we’ll take it from there.',
          ),
          emailCodeBlock('482913'),
          emailNotice('This code expires after 10 minutes.'),
          emailSection(
            'Keep your account secure:',
            'Never share this code. Agentra will never ask for it by phone or chat.',
          ),
          emailSection(
            'We’re here to help',
            `Didn’t request this? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
    magic: {
      label: 'Magic link',
      html: emailShell({
        title: 'Your sign-in link',
        bodyHtml: [
          emailHeading('Your sign-in link is ready'),
          emailParagraph('Hi Kashif,'),
          emailParagraph(
            'Tap below to jump straight into <strong>Agentra</strong>. No password typing required this time.',
          ),
          emailButton(magicUrl, 'Sign in to Agentra'),
          emailNotice('This link expires after 15 minutes and can only be used once.'),
          emailSection(
            'Keep your account secure:',
            'If you didn’t ask for this link, ignore this email. Your account stays locked up tight.',
          ),
          emailSection(
            'We’re here to help',
            `Need a hand? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
    welcome: {
      label: 'Welcome',
      html: emailShell({
        title: 'Welcome to Agentra',
        bodyHtml: [
          emailHeading('You’re in, Kashif'),
          emailParagraph(
            'Your <strong>Acme</strong> workspace on <strong>Agentra</strong> is ready. Inbox, AI agent, and team tools, all in one place.',
          ),
          emailButton(dashUrl, 'Open your dashboard'),
          emailNotice(
            `Workspace URL: <a href="${dashUrl}" style="color:${BRAND.link};text-decoration:underline;">acme.agentraa.com</a>`,
          ),
          emailParagraph('<strong>A few ways to get going:</strong>'),
          emailSteps([
            'Invite your teammates',
            'Connect your support channels',
            'Tune your AI agent and helpdesk',
          ]),
          emailSection(
            'We’re here to help',
            `Stuck on setup? The <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a> has your back.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
    invite: {
      label: 'Team invite',
      html: emailShell({
        title: "You're invited",
        bodyHtml: [
          emailHeading('You’ve been invited to Agentra'),
          emailParagraph('Hi Sam,'),
          emailParagraph(
            '<strong>Kashif Ahmed</strong> wants you on the <strong>Acme</strong> workspace as a <strong>agent</strong>. Accept below and you’re part of the crew.',
          ),
          emailButton('https://acme.agentraa.com/auth/accept-invite?token=preview', 'Accept invitation'),
          emailNotice('This invite link expires after 7 days.'),
          emailSection(
            'Keep your account secure:',
            'Wasn’t expecting this? Ignore the email. Nothing changes until you accept.',
          ),
          emailSection(
            'We’re here to help',
            `Questions about roles or access? Visit the <a href="${LEGAL.helpCenter}" style="color:${BRAND.link};text-decoration:underline;">Help Center</a>.`,
          ),
          emailSignOff(),
        ].join(''),
      }),
    },
  };

  return templates[id] || null;
}

function renderAppPage() {
  const templateIds = ['reset', 'verification', 'otp', 'magic', 'welcome', 'invite'];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agentra email preview</title>
  <link href="${FONT_IMPORT}" rel="stylesheet" />
  <style>
    body { margin:0; font-family:${FONT_BODY}; background:#f4f5f7; color:#1a1d26; }
    .tabs { display:flex; flex-wrap:wrap; gap:8px; padding:20px; }
    .tab { border:1px solid #e6e8ee; background:#fff; border-radius:999px; padding:8px 14px; cursor:pointer; font:inherit; }
    .tab.active { background:#1a1d26; color:#fff; border-color:#1a1d26; }
    iframe { width:100%; height:900px; border:0; background:#fff; }
  </style>
</head>
<body>
  <div class="tabs" id="tabs">
    ${templateIds
      .map((id) => {
        const t = buildTemplate(id);
        return `<button type="button" class="tab" data-template="${id}">${escapeHtml(t.label)}</button>`;
      })
      .join('')}
  </div>
  <iframe id="preview" title="Email preview"></iframe>
  <script>
    const state = { template: 'reset' };
    function refresh() {
      document.querySelectorAll('.tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.template === state.template);
      });
      document.getElementById('preview').src =
        '/render?template=' + encodeURIComponent(state.template) +
        '&heading=jakarta&body=jakarta&t=' + Date.now();
    }
    document.getElementById('tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      state.template = tab.dataset.template;
      refresh();
    });
    refresh();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderAppPage());
    return;
  }

  if (url.pathname.startsWith('/logos/')) {
    const file = path.basename(url.pathname);
    const full = path.join(LOGO_DIR, file);
    if (!full.startsWith(LOGO_DIR) || !fs.existsSync(full)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(full));
    return;
  }

  if (url.pathname === '/render') {
    const templateId = url.searchParams.get('template') || 'reset';
    const heading = url.searchParams.get('heading') || 'jakarta';
    const body = url.searchParams.get('body') || 'jakarta';
    const tpl = buildTemplate(templateId);
    if (!tpl) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Unknown template');
      return;
    }
    const html = withPreviewLogos(applyFonts(tpl.html, heading, body));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Agentra email preview: http://127.0.0.1:${PORT}`);
});
