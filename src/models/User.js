const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model
 * A user always belongs to a company (tenant).
 * Their effective URL is the company subdomain: lyca.agentraa.com
 */

const userSchema = new mongoose.Schema(
  {
    // Core identity
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: { type: String, trim: true },
    avatar: { type: String },

    // Multi-tenancy: every user belongs to one company
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'User must belong to a company'],
    },

    // Role within the company
    role: {
      type: String,
      enum: ['owner', 'admin', 'agent', 'customer'],
      default: 'customer',
    },

    // Department the user/agent belongs to
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },

    // Job title
    jobTitle: { type: String, trim: true },

    // Short profile bio
    bio: { type: String, trim: true, maxlength: [280, 'Bio cannot exceed 280 characters'] },

    // ─── Authentication ────────────────────────────────────────────────────────

    // Password-based auth (optional — users may be passwordless-only)
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },
    hasPassword: { type: Boolean, default: false },

    // Passwordless: magic link token
    magicLinkToken: { type: String, select: false },
    magicLinkTokenExpires: { type: Date, select: false },

    // Passwordless: email OTP
    otpCode: { type: String, select: false },
    otpCodeExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },

    // Refresh token family (for rotation)
    refreshTokens: [
      {
        token: { type: String, select: false },
        createdAt: { type: Date, default: Date.now },
        userAgent: String,
        ip: String,
        expiresAt: Date,
      },
    ],

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    // Password reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // ─── Status & security ─────────────────────────────────────────────────────

    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },

    // Failed login tracking
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Activity
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    lastSeenAt: { type: Date },

    // Onboarding
    onboardingCompleted: { type: Boolean, default: false },

    // Preferences
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        browser: { type: Boolean, default: true },
        volume: { type: Number, default: 70, min: 0, max: 100 },
        rules: { type: Object, default: undefined },
      },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, enum: ['DMY', 'MDY'], default: 'MDY' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
      locale: { type: String, default: 'en' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound unique index: email is unique per company ─────────────────────
// Two different companies CAN have users with the same email (different tenants)
userSchema.index({ email: 1, company: 1 }, { unique: true });
userSchema.index({ company: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: account is locked
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ─── Pre-save: hash password ─────────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.hasPassword = true;
});

// ─── Instance methods ────────────────────────────────────────────────────────

// Compare plain password with hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Increment failed login attempts; lock after 5
userSchema.methods.incLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  // Reset if previous lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};

// Reset login attempts on successful auth
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLoginAt: new Date() },
    $unset: { lockUntil: 1 },
  });
};

// Remove sensitive fields when serializing
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.magicLinkToken;
  delete obj.magicLinkTokenExpires;
  delete obj.otpCode;
  delete obj.otpCodeExpires;
  delete obj.otpAttempts;
  delete obj.refreshTokens;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
