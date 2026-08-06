const crypto = require('crypto');

/**
 * Parse Meta's signed_request payload (data deletion + deauthorize callbacks).
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
function parseMetaSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') {
    throw new Error('Missing signed_request');
  }
  if (!appSecret) {
    throw new Error('META_APP_SECRET is not configured');
  }

  const parts = signedRequest.split('.', 2);
  if (parts.length !== 2) {
    throw new Error('Invalid signed_request format');
  }

  const [encodedSig, payload] = parts;
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();

  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error('Invalid signed_request signature');
  }

  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const data = JSON.parse(json);

  if (!data?.user_id) {
    throw new Error('signed_request missing user_id');
  }

  return data;
}

module.exports = { parseMetaSignedRequest };
