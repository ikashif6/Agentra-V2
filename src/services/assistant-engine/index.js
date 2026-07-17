/**
 * Config-aware assistant engine public surface.
 */

module.exports = {
  ...require('./assistant-engine.service'),
  loadRuntimeConfig: require('./assistant-runtime-config.service').loadRuntimeConfig,
  normalizeRuntimeConfig: require('./assistant-runtime-config.service').normalizeRuntimeConfig,
  bumpAssistantConfigVersion: require('./assistant-config-version.service').bumpAssistantConfigVersion,
  mapAllowedActionsToCapabilities: require('./assistant-capability.service').mapAllowedActionsToCapabilities,
  enforceCapability: require('./assistant-capability.service').enforceCapability,
  resolveAuthority: require('./assistant-authority.service').resolveAuthority,
  profileOwnerInstructions: require('./assistant-authority.service').profileOwnerInstructions,
};
