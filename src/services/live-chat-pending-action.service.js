const crypto = require('crypto');
const PendingAgentAction = require('../models/PendingAgentAction');

function signingSecret() {
  return process.env.JWT_SECRET || process.env.AI_ACTION_SECRET || 'dev-insecure-action-secret';
}

function hashToken(token) {
  return crypto.createHmac('sha256', signingSecret()).update(String(token)).digest('hex');
}

function createTokenPayload(actionId, expiresAt) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
  const body = `${actionId}.${exp}.${nonce}`;
  const sig = crypto.createHmac('sha256', signingSecret()).update(body).digest('hex');
  return `${body}.${sig}`;
}

function verifyTokenShape(token, actionId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return { ok: false, code: 'CONFIRMATION_INVALID' };
  const [id, expStr, nonce, sig] = parts;
  if (id !== actionId) return { ok: false, code: 'CONFIRMATION_MISMATCH' };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return { ok: false, code: 'CONFIRMATION_EXPIRED' };
  }
  const body = `${id}.${expStr}.${nonce}`;
  const expected = crypto.createHmac('sha256', signingSecret()).update(body).digest('hex');
  if (sig.length !== expected.length) return { ok: false, code: 'CONFIRMATION_INVALID' };
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, code: 'CONFIRMATION_INVALID' };
    }
  } catch {
    return { ok: false, code: 'CONFIRMATION_INVALID' };
  }
  return { ok: true };
}

async function createPendingAction({
  companyId,
  sessionId,
  type,
  args,
  ttlMinutes,
}) {
  const actionId = `action_${crypto.randomBytes(12).toString('hex')}`;
  const minutes = Number(
    ttlMinutes || process.env.AI_CONFIRMATION_EXPIRY_MINUTES || 15,
  );
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  const token = createTokenPayload(actionId, expiresAt);
  const idempotencyKey = `${type}:${sessionId}:${crypto
    .createHash('sha256')
    .update(JSON.stringify(args || {}))
    .digest('hex')
    .slice(0, 24)}`;

  // Reuse open pending with same idempotency key
  const existing = await PendingAgentAction.findOne({
    idempotencyKey,
    status: 'awaiting_confirmation',
    expiresAt: { $gt: new Date() },
  });
  if (existing) {
    return { action: existing, token: null, reused: true };
  }

  const action = await PendingAgentAction.create({
    company: companyId,
    session: sessionId,
    actionId,
    type,
    status: 'awaiting_confirmation',
    arguments: args || {},
    confirmationTokenHash: hashToken(token),
    idempotencyKey,
    expiresAt,
  });

  return { action, token, reused: false };
}

async function confirmAndExecute(actionId, token, executor) {
  const action = await PendingAgentAction.findOne({ actionId });
  if (!action) {
    return { ok: false, code: 'ACTION_NOT_FOUND' };
  }
  if (action.status === 'executed') {
    return { ok: true, alreadyExecuted: true, result: action.result, action };
  }
  if (action.status !== 'awaiting_confirmation' && action.status !== 'confirmed') {
    return { ok: false, code: 'ACTION_NOT_CONFIRMABLE', status: action.status };
  }
  if (action.expiresAt.getTime() < Date.now()) {
    action.status = 'expired';
    await action.save();
    return { ok: false, code: 'CONFIRMATION_EXPIRED' };
  }

  const shape = verifyTokenShape(token, actionId);
  if (!shape.ok) return shape;

  if (hashToken(token) !== action.confirmationTokenHash) {
    return { ok: false, code: 'CONFIRMATION_INVALID' };
  }

  // Optimistic lock
  const locked = await PendingAgentAction.findOneAndUpdate(
    {
      _id: action._id,
      status: 'awaiting_confirmation',
      version: action.version,
    },
    {
      $set: { status: 'confirmed', confirmedAt: new Date() },
      $inc: { version: 1 },
    },
    { new: true },
  );
  if (!locked) {
    const again = await PendingAgentAction.findById(action._id);
    if (again?.status === 'executed') {
      return { ok: true, alreadyExecuted: true, result: again.result, action: again };
    }
    return { ok: false, code: 'CONCURRENT_CONFIRMATION' };
  }

  try {
    const result = await executor(locked.arguments, locked);
    locked.status = 'executed';
    locked.executedAt = new Date();
    locked.result = result;
    await locked.save();
    return { ok: true, result, action: locked };
  } catch (err) {
    locked.status = 'failed';
    locked.errorCode = err.code || 'ACTION_EXECUTION_FAILED';
    locked.result = { message: err.safeMessage || err.message };
    await locked.save();
    return {
      ok: false,
      code: locked.errorCode,
      message: err.safeMessage || 'Could not complete that action.',
      action: locked,
    };
  }
}

function buildConfirmationCard(action, token, { title, summaryLines, confirmLabel }) {
  return {
    formId: 'action_confirm',
    title: title || 'Please confirm',
    fields: [
      {
        name: 'confirmationToken',
        type: 'hidden',
        value: token,
      },
      {
        name: 'actionId',
        type: 'hidden',
        value: action.actionId,
      },
    ],
    summaryLines: summaryLines || [],
    submitLabel: confirmLabel || 'Confirm',
    cancelLabel: 'Cancel',
    actionType: action.type,
  };
}

module.exports = {
  createPendingAction,
  confirmAndExecute,
  buildConfirmationCard,
  hashToken,
  verifyTokenShape,
  createTokenPayload,
};
