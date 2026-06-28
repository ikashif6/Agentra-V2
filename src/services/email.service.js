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

const FROM = () => `${process.env.RESEND_FROM_NAME || 'Agentraa'} <${process.env.RESEND_FROM_EMAIL || 'noreply@agentraa.com'}>`;
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'agentraa.com';
const FRONTEND_URL = process.env.APP_FRONTEND_URL || 'https://app.agentraa.com';

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
  const companyUrl = `https://${subdomain}.${BASE_DOMAIN}`;
  const verifyUrl = `${companyUrl}/auth/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your Agentraa email address',
    text: `Hi ${user.firstName},\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Verify your email address</h2>
          <p style="color: #6B7280;">Hi ${user.firstName},</p>
          <p style="color: #6B7280;">Thanks for signing up! Please verify your email address to get started.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px;">Or copy this link: <a href="${verifyUrl}" style="color: #4F46E5;">${verifyUrl}</a></p>
          <p style="color: #9CA3AF; font-size: 14px;">This link expires in <strong>24 hours</strong>. If you didn't create an account, please ignore this email.</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
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
    subject: 'Your Agentraa sign-in link',
    text: `Hi ${user.firstName},\n\nClick this link to sign in to Agentraa:\n${magicUrl}\n\nThis link expires in ${expiresMinutes} minutes and can only be used once.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Your sign-in link</h2>
          <p style="color: #6B7280;">Hi ${user.firstName},</p>
          <p style="color: #6B7280;">Click the button below to sign in to your Agentraa account. This link is valid for <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${magicUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Sign In to Agentraa
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px;">Or copy this link: <a href="${magicUrl}" style="color: #4F46E5;">${magicUrl}</a></p>
          <p style="color: #9CA3AF; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
            🔒 If you didn't request this link, you can safely ignore this email. Your account is secure.
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
  });
}

/**
 * Send OTP code (passwordless login)
 */
async function sendOtpCode({ user, otp, subdomain }) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 10;

  await sendEmail({
    to: user.email,
    subject: `${otp} is your Agentraa verification code`,
    text: `Hi ${user.firstName},\n\nYour Agentraa verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Your verification code</h2>
          <p style="color: #6B7280;">Hi ${user.firstName},</p>
          <p style="color: #6B7280;">Use this code to verify your identity. It expires in <strong>${expiresMinutes} minutes</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="background: #F3F4F6; border: 2px dashed #D1D5DB; border-radius: 12px; padding: 24px; display: inline-block;">
              <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #111827; font-family: 'Courier New', monospace;">
                ${otp}
              </span>
            </div>
          </div>
          <p style="color: #9CA3AF; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
            🔒 If you didn't request this code, you can safely ignore this email. Your account is secure.
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
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
    subject: 'Reset your Agentraa password',
    text: `Hi ${user.firstName},\n\nReset your password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Reset your password</h2>
          <p style="color: #6B7280;">Hi ${user.firstName},</p>
          <p style="color: #6B7280;">We received a request to reset your password. Click the button below to choose a new one.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background: #DC2626; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px;">Or copy this link: <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a></p>
          <p style="color: #9CA3AF; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
            ⚠️ This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
  });
}

/**
 * Send welcome email after company registration
 */
async function sendWelcomeEmail({ user, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/dashboard`;

  await sendEmail({
    to: user.email,
    subject: `Welcome to Agentraa — ${company.name} workspace is ready`,
    text: `Hi ${user.firstName},\n\nWelcome to Agentraa! Your workspace for ${company.name} is ready.\n\nAccess your dashboard: ${dashboardUrl}\n\nYour subdomain: ${company.subdomain}.${BASE_DOMAIN}\n\nGet started by inviting your team and creating your first ticket.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Welcome, ${user.firstName}! 🎉</h2>
          <p style="color: #6B7280;">Your <strong>${company.name}</strong> workspace on Agentraa is ready to go.</p>
          <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #6B7280; font-size: 14px;">Your workspace URL:</p>
            <p style="margin: 4px 0 0; font-weight: 600; color: #4F46E5;">
              <a href="${dashboardUrl}" style="color: #4F46E5;">${company.subdomain}.${BASE_DOMAIN}</a>
            </p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Go to Dashboard
            </a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Get started by inviting your team members and setting up your first ticket category.</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
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
    subject: `${inviter.firstName} invited you to join ${company.name} on Agentraa`,
    text: `Hi ${user.firstName},\n\n${inviter.firstName} ${inviter.lastName} has invited you to join ${company.name} as a ${user.role}.\n\nAccept your invite: ${acceptUrl}\n\nThis link expires in 7 days.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg,#E8470A,#C73A08); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">You're invited 🎉</h2>
          <p style="color: #6B7280;">Hi ${user.firstName},</p>
          <p style="color: #6B7280;">
            <strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join
            <strong>${company.name}</strong> on Agentraa as a <strong>${user.role}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${acceptUrl}" style="background: #E8470A; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px;">This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
  });
}

/**
 * Send team membership invite notification
 */
async function sendTeamInvite({ invitee, inviter, team, company }) {
  const dashboardUrl = `https://${company.subdomain}.${BASE_DOMAIN}/teams/${team._id}`;

  await sendEmail({
    to: invitee.email,
    subject: `You've been added to the ${team.name} team on Agentraa`,
    text: `Hi ${invitee.firstName},\n\n${inviter.firstName} ${inviter.lastName} has added you to the "${team.name}" team at ${company.name}.\n\nView the team: ${dashboardUrl}\n\nIf you think this was a mistake, please contact your workspace admin.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">You've been added to a team</h2>
          <p style="color: #6B7280;">Hi ${invitee.firstName},</p>
          <p style="color: #6B7280;">
            <strong>${inviter.firstName} ${inviter.lastName}</strong> has added you to the
            <strong>${team.name}</strong> team at <strong>${company.name}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dashboardUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
              View Team
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
            If you think this was a mistake, please contact your workspace admin.
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
  });
}

/**
 * Send OTP for ticket tracking (unauthenticated customer flow)
 */
async function sendTicketTrackOtp({ email, firstName, otp, ticket_code, subdomain }) {
  const expiresMinutes = process.env.TRACK_OTP_EXPIRES_MINUTES || 10;

  await sendEmail({
    to: email,
    subject: `${otp} — Your Agentraa ticket tracking code`,
    text: `Hi ${firstName},\n\nYour one-time code to track ticket ${ticket_code} is:\n\n${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Agentraa</h1>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827; margin-top: 0;">Track your ticket</h2>
          <p style="color: #6B7280;">Hi ${firstName},</p>
          <p style="color: #6B7280;">
            Use the code below to access ticket
            <strong style="color: #111827;">${ticket_code}</strong>.
            It expires in <strong>${expiresMinutes} minutes</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="background: #F3F4F6; border: 2px dashed #D1D5DB; border-radius: 12px; padding: 24px; display: inline-block;">
              <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #111827; font-family: 'Courier New', monospace;">
                ${otp}
              </span>
            </div>
          </div>
          <p style="color: #9CA3AF; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
            🔒 If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 16px;">
          © ${new Date().getFullYear()} Agentraa. All rights reserved.
        </p>
      </div>
    `,
  });
}

module.exports = {
  sendEmailVerification,
  sendMagicLink,
  sendOtpCode,
  sendPasswordReset,
  sendWelcomeEmail,
  sendTicketTrackOtp,
  sendTeamInvite,
  sendTeamInviteByOwner,
};
