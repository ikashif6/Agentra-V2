const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * TicketTrackSession
 *
 * Powers the "track ticket by OTP" flow for customers who are NOT logged in.
 *
 * Flow:
 *  1. Customer POSTs /tickets/track/request  { ticket_code, email }
 *     → we verify the email matches a 'customer' in ticket.peoples
 *     → we generate OTP, store hashed here, send raw OTP to email
 *
 *  2. Customer POSTs /tickets/track/verify   { ticket_code, email, otp }
 *     → verify OTP
 *     → issue a short-lived signed session token (JWT or opaque)
 *     → delete this doc
 *
 *  3. Customer uses the session token as   Authorization: Bearer <trackToken>
 *     A dedicated middleware (resolveTrackSession) reads it and attaches
 *     req.trackSession = { ticketId, email, userId }
 *     downstream routes check req.trackSession as an alternative to req.user
 */

const ticketTrackSessionSchema = new Schema(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
    },
    ticket_code: { type: String, required: true, uppercase: true },
    company_subdomain: { type: String, required: true, lowercase: true },

    // The customer's email — must match a 'customer' entry in ticket.peoples
    email: { type: String, required: true, lowercase: true },

    // Hashed OTP (raw sent to email)
    otpHash: { type: String, required: true, select: false },
    otpExpires: { type: Date, required: true },
    attempts: { type: Number, default: 0 },

    // IP rate-limiting helpers
    requestIp: { type: String },

    // After successful verify we mark as used rather than delete immediately
    // so concurrent verify requests don't cause double-use
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Auto-expire documents 1 hour after creation (TTL index)
ticketTrackSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
ticketTrackSessionSchema.index({ ticket_code: 1, email: 1 });

module.exports = mongoose.model('TicketTrackSession', ticketTrackSessionSchema);
