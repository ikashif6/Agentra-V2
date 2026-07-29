const test = require('node:test');
const assert = require('node:assert/strict');

const { formatSupportEmail } = require('../src/services/email-channel.service');

test('support email turns plain-text paragraphs into readable HTML', () => {
  const formatted = formatSupportEmail(
    'Hi there,\n\nI can help update your shipping address.\nPlease send the complete address.\n\nThank you.',
  );

  assert.equal(
    formatted.text,
    'Hi there,\n\nI can help update your shipping address.\nPlease send the complete address.\n\nThank you.',
  );
  assert.match(formatted.html, /<p[^>]*>Hi there,<\/p>/);
  assert.match(
    formatted.html,
    /I can help update your shipping address\.<br>Please send the complete address\./,
  );
  assert.match(formatted.html, /<p[^>]*>Thank you\.<\/p>/);
});

test('support email escapes content and makes links clickable', () => {
  const formatted = formatSupportEmail(
    'See <this> page:\nhttps://example.com/order/1001',
  );

  assert.doesNotMatch(formatted.html, /<this>/);
  assert.match(formatted.html, /&lt;this&gt;/);
  assert.match(formatted.html, /href="https:\/\/example\.com\/order\/1001"/);
});

