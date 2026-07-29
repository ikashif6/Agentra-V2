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
  orangeDark: '#C73A08',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#e5e7eb',
  surface: '#F3F4F6',
};

const fs = require('fs');
const path = require('path');

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

function getEmailLogoSrc() {
  if (process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;

  const logoPath = path.join(__dirname, '../../client/public/agentraa-logo.svg');
  try {
    const svg = fs.readFileSync(logoPath, 'utf8').trim();
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch {
    const base = FRONTEND_URL.replace(/\/$/, '');
    return `${base}/agentraa-logo.svg`;
  }
}

function emailShell(bodyHtml) {
  const logoSrc = getEmailLogoSrc();
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #ffffff; padding: 32px; border: 1px solid ${BRAND.border}; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <img src="${logoSrc}" alt="Agentra" width="200" height="45" style="display: inline-block; max-width: 200px; height: auto; border: 0;" />
        </div>
        ${bodyHtml}
      </div>
      <p style="color: ${BRAND.faint}; font-size: 12px; text-align: center; margin-top: 16px;">
        © ${new Date().getFullYear()} Agentra. All rights reserved.
      </p>
    </div>
  `;
}

function emailButton(href, label, background = BRAND.orange) {
  return `<a href="${href}" style="background: ${background}; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">${label}</a>`;
}

function emailLinkFallback(url) {
  return `<p style="color: ${BRAND.faint}; font-size: 14px;">Or copy this link: <a href="${url}" style="color: ${BRAND.orange};">${url}</a></p>`;
}

/**
 * Core send helper — wraps Resend and logs in dev
 */
async function sendEmail({ to, subject, html, text }) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n📧 [EMAIL] To: ${to} | Subject: ${subject}`);
    if (text) console.log(text);
    console.log('---');
  }

  const { data, error } = await getResend().emails.send({
    from: FROM(),
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Send email verification link
 */
async function sendEmailVerification({ user, token, subdomain }) {
  const verifyUrl = buildVerifyEmailUrl(subdomain, token);
  const workspaceHost = `${subdomain}.${BASE_DOMAIN}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your Agentra email address',
    text: `Hi ${user.firstName},\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, you can ignore this email.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Verify your email address</h2>
          <p style="color: ${BRAND.muted};">Hi ${user.firstName},</p>
          <p style="color: ${BRAND.muted};">Thanks for signing up! Your workspace will be at <strong>${workspaceHost}</strong>. Please verify your email to get started.</p>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(verifyUrl, 'Verify Email Address')}
          </div>
          ${emailLinkFallback(verifyUrl)}
          <p style="color: ${BRAND.faint}; font-size: 14px;">This link expires in <strong>24 hours</strong>. If you didn't create an account, please ignore this email.</p>
    `),
  });
}

/**
 * Send magic link (passwordless login)
 */
async function sendMagicLink({ user, token, subdomain }) {
  const companyUrl = subdomain ? `https://${subdomain}.${BASE_DOMAIN}` : FRONTEND_URL;
  const magicUrl = `${companyUrl}/auth/magic-link?token=${token}`;
  const expiresMinutes = process.env.MAGIC_LINK_EXPIRES_MINUTES || 15;

  await sendEmail({
    to: user.email,
    subject: 'Your Agentra sign-in link',
    text: `Hi ${user.firstName},\n\nClick this link to sign in to Agentra:\n${magicUrl}\n\nThis link expires in ${expiresMinutes} minutes and can only be used once.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Your sign-in link</h2>
          <p style="color: ${BRAND.muted};">Hi ${user.firstName},</p>
          <p style="color: ${BRAND.muted};">Click the button below to sign in to your Agentra account. This link is valid for <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(magicUrl, 'Sign In to Agentra')}
          </div>
          ${emailLinkFallback(magicUrl)}
          <p style="color: ${BRAND.faint}; font-size: 14px; border-top: 1px solid ${BRAND.border}; padding-top: 16px; margin-top: 24px;">
            If you didn't request this link, you can safely ignore this email. Your account is secure.
          </p>
    `),
  });
}

/**
 * Send OTP code (passwordless login)
 */
async function sendOtpCode({ user, otp, subdomain }) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 10;

  await sendEmail({
    to: user.email,
    subject: `${otp} is your Agentra verification code`,
    text: `Hi ${user.firstName},\n\nYour Agentra verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Your verification code</h2>
          <p style="color: ${BRAND.muted};">Hi ${user.firstName},</p>
          <p style="color: ${BRAND.muted};">Use this code to verify your identity. It expires in <strong>${expiresMinutes} minutes</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="background: ${BRAND.surface}; border: 2px dashed #D1D5DB; border-radius: 12px; padding: 24px; display: inline-block;">
              <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: ${BRAND.text}; font-family: 'Courier New', monospace;">
                ${otp}
              </span>
            </div>
          </div>
          <p style="color: ${BRAND.faint}; font-size: 14px; border-top: 1px solid ${BRAND.border}; padding-top: 16px; margin-top: 24px;">
            If you didn't request this code, you can safely ignore this email. Your account is secure.
          </p>
    `),
  });
}

/**
 * Send password reset link
 */
async function sendPasswordReset({ user, token, subdomain }) {
  const companyUrl = subdomain ? `https://${subdomain}.${BASE_DOMAIN}` : FRONTEND_URL;
  const resetUrl = `${companyUrl}/auth/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your Agentra password',
    text: `Hi ${user.firstName},\n\nReset your password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, please ignore this email.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Reset your password</h2>
          <p style="color: ${BRAND.muted};">Hi ${user.firstName},</p>
          <p style="color: ${BRAND.muted};">We received a request to reset your password. Click the button below to choose a new one.</p>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(resetUrl, 'Reset Password', '#DC2626')}
          </div>
          ${emailLinkFallback(resetUrl)}
          <p style="color: ${BRAND.faint}; font-size: 14px; border-top: 1px solid ${BRAND.border}; padding-top: 16px; margin-top: 24px;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
    `),
  });
}

/**
 * Send welcome email after company registration
 */
async function sendWelcomeEmail({ user, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/dashboard`;

  await sendEmail({
    to: user.email,
    subject: `Welcome to Agentra: ${company.name} workspace is ready`,
    text: `Hi ${user.firstName},\n\nWelcome to Agentra! Your workspace for ${company.name} is ready.\n\nAccess your dashboard: ${dashboardUrl}\n\nYour subdomain: ${company.subdomain}.${BASE_DOMAIN}\n\nGet started by inviting your team and creating your first ticket.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Welcome, ${user.firstName}!</h2>
          <p style="color: ${BRAND.muted};">Your <strong>${company.name}</strong> workspace on Agentra is ready to go.</p>
          <div style="background: ${BRAND.surface}; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: ${BRAND.muted}; font-size: 14px;">Your workspace URL:</p>
            <p style="margin: 4px 0 0; font-weight: 600; color: ${BRAND.orange};">
              <a href="${dashboardUrl}" style="color: ${BRAND.orange};">${company.subdomain}.${BASE_DOMAIN}</a>
            </p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(dashboardUrl, 'Go to Dashboard')}
          </div>
          <p style="color: ${BRAND.muted}; font-size: 14px;">Get started by inviting your team members and setting up your first ticket category.</p>
    `),
  });
}

/**
 * Send workspace invite (owner/admin inviting a new agent/admin)
 */
async function sendTeamInviteByOwner({ user, token, company, inviter }) {
  const BASE = process.env.APP_BASE_DOMAIN || 'agentraa.com';
  const acceptUrl = `https://${company.subdomain}.${BASE}/auth/accept-invite?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: `${inviter.firstName} invited you to join ${company.name} on Agentra`,
    text: `Hi ${user.firstName},\n\n${inviter.firstName} ${inviter.lastName} has invited you to join ${company.name} as a ${user.role}.\n\nAccept your invite: ${acceptUrl}\n\nThis link expires in 7 days.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">You're invited</h2>
          <p style="color: ${BRAND.muted};">Hi ${user.firstName},</p>
          <p style="color: ${BRAND.muted};">
            <strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join
            <strong>${company.name}</strong> on Agentra as a <strong>${user.role}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(acceptUrl, 'Accept Invitation', BRAND.orangeDark)}
          </div>
          <p style="color: ${BRAND.faint}; font-size: 14px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
    `),
  });
}

/**
 * Send team membership invite notification
 */
async function sendTeamInvite({ invitee, inviter, team, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/teams/${team._id}`;

  await sendEmail({
    to: invitee.email,
    subject: `You've been added to the ${team.name} team on Agentra`,
    text: `Hi ${invitee.firstName},\n\n${inviter.firstName} ${inviter.lastName} has added you to the "${team.name}" team at ${company.name}.\n\nView the team: ${dashboardUrl}\n\nIf you think this was a mistake, please contact your workspace admin.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">You've been added to a team</h2>
          <p style="color: ${BRAND.muted};">Hi ${invitee.firstName},</p>
          <p style="color: ${BRAND.muted};">
            <strong>${inviter.firstName} ${inviter.lastName}</strong> has added you to the
            <strong>${team.name}</strong> team at <strong>${company.name}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            ${emailButton(dashboardUrl, 'View Team')}
          </div>
          <p style="color: ${BRAND.faint}; font-size: 14px; border-top: 1px solid ${BRAND.border}; padding-top: 16px; margin-top: 24px;">
            If you think this was a mistake, please contact your workspace admin.
          </p>
    `),
  });
}

/**
 * Send OTP for ticket tracking (unauthenticated customer flow)
 */
async function sendTicketTrackOtp({ email, firstName, otp, ticket_code, subdomain }) {
  const expiresMinutes = process.env.TRACK_OTP_EXPIRES_MINUTES || 10;

  await sendEmail({
    to: email,
    subject: `${otp} is your Agentra ticket tracking code`,
    text: `Hi ${firstName},\n\nYour one-time code to track ticket ${ticket_code} is:\n\n${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: emailShell(`
          <h2 style="color: ${BRAND.text}; margin-top: 0;">Track your ticket</h2>
          <p style="color: ${BRAND.muted};">Hi ${firstName},</p>
          <p style="color: ${BRAND.muted};">
            Use the code below to access ticket
            <strong style="color: ${BRAND.text};">${ticket_code}</strong>.
            It expires in <strong>${expiresMinutes} minutes</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="background: ${BRAND.surface}; border: 2px dashed #D1D5DB; border-radius: 12px; padding: 24px; display: inline-block;">
              <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: ${BRAND.text}; font-family: 'Courier New', monospace;">
                ${otp}
              </span>
            </div>
          </div>
          <p style="color: ${BRAND.faint}; font-size: 14px; border-top: 1px solid ${BRAND.border}; padding-top: 16px; margin-top: 24px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
    `),
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
  sendEmail,
  sendEmailVerification,
  sendMagicLink,
  sendOtpCode,
  sendPasswordReset,
  sendWelcomeEmail,
  sendTicketTrackOtp,
  sendTeamInvite,
  sendTeamInviteByOwner,
  sendChannelReplyViaResend,
};
