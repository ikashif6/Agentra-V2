/**
 * Channel connect/disconnect helpers.
 *
 * Reassigning `company.channelIntegrations` marks the whole nested path dirty,
 * so Mongoose writes `$set` for every channel block using the in-memory doc.
 * Credentials are `select: false`, so any block the document didn't load gets
 * written back without its token — connecting one channel silently wiped the
 * secrets of all the others. Only create the parent when it is truly absent.
 */
function ensureChannelIntegrations(company) {
  if (!company.channelIntegrations) company.channelIntegrations = {};
  return company.channelIntegrations;
}

module.exports = { ensureChannelIntegrations };
