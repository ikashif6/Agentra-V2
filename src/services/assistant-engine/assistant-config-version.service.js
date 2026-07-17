/**
 * Atomic assistant configuration version bumps.
 * Cache invalidation for per-turn runtime config is keyed by this version.
 */

const Company = require('../../models/Company');

/**
 * Atomically increment Company.aiAgent.assistantConfigVersion.
 * Safe to call after successful settings/knowledge/hours/integration writes.
 * No-ops when MongoDB is not connected (unit tests / offline).
 */
async function bumpAssistantConfigVersion(companyId, reason = 'config_change') {
  if (!companyId) return null;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return null;
  } catch {
    return null;
  }
  const updated = await Company.findByIdAndUpdate(
    companyId,
    {
      $inc: { 'aiAgent.assistantConfigVersion': 1 },
      $set: {
        'aiAgent.assistantConfigVersionUpdatedAt': new Date(),
        'aiAgent.assistantConfigVersionReason': String(reason || 'config_change').slice(0, 120),
      },
    },
    { new: true, select: 'aiAgent.assistantConfigVersion' },
  );
  const version = Number(updated?.aiAgent?.assistantConfigVersion || 1);
  try {
    console.info(
      '[assistant-config-version]',
      JSON.stringify({ companyId: String(companyId), version, reason }),
    );
  } catch {
    /* ignore */
  }
  return version;
}

function readAssistantConfigVersion(company) {
  const v = Number(company?.aiAgent?.assistantConfigVersion);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function readAssistantEngineMode(company) {
  const fromCompany = String(company?.aiAgent?.assistantEngine || '').toLowerCase();
  if (fromCompany === 'v3' || fromCompany === 'shadow' || fromCompany === 'v2' || fromCompany === 'v1') {
    return fromCompany;
  }
  return null;
}

module.exports = {
  bumpAssistantConfigVersion,
  readAssistantConfigVersion,
  readAssistantEngineMode,
};
