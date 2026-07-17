const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildShopifyInstallUrl,
} = require('../src/services/store-oauth.service');

const ORIGINAL_ENV = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_CUSTOM_INSTALL_LINK: process.env.SHOPIFY_CUSTOM_INSTALL_LINK,
  JWT_SECRET: process.env.JWT_SECRET,
};

function customInstallLink({ clientId, store, expiresAt }) {
  const payload = Buffer.from(
    JSON.stringify({
      expires_at: expiresAt,
      permanent_domain: store,
      client_id: clientId,
      purpose: 'custom_app',
    }),
  ).toString('base64');
  return `https://admin.shopify.com/oauth/install_custom_app?client_id=${clientId}&signature=${encodeURIComponent(`${payload}--test`)}`;
}

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Shopify reconnect URL', () => {
  it('falls back to OAuth when a custom install link has expired', () => {
    process.env.SHOPIFY_API_KEY = 'client-id';
    process.env.SHOPIFY_API_SECRET = 'client-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SHOPIFY_CUSTOM_INSTALL_LINK = customInstallLink({
      clientId: 'client-id',
      store: 'example.myshopify.com',
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });

    const url = new URL(
      buildShopifyInstallUrl({
        shopDomain: 'example.myshopify.com',
        companyId: 'company-id',
        subdomain: 'workspace',
        userId: 'user-id',
        returnOrigin: 'http://workspace.localhost:3000',
        returnPath: '/settings?item=store',
      }),
    );

    assert.equal(url.origin, 'https://example.myshopify.com');
    assert.equal(url.pathname, '/admin/oauth/authorize');
    assert.equal(url.searchParams.get('client_id'), 'client-id');
    assert.ok(url.searchParams.get('state'));
  });

  it('keeps using a valid custom install link for first installation', () => {
    process.env.SHOPIFY_API_KEY = 'client-id';
    process.env.SHOPIFY_API_SECRET = 'client-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SHOPIFY_CUSTOM_INSTALL_LINK = customInstallLink({
      clientId: 'client-id',
      store: 'example.myshopify.com',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const url = new URL(
      buildShopifyInstallUrl({
        shopDomain: 'example.myshopify.com',
        companyId: 'company-id',
        subdomain: 'workspace',
        userId: 'user-id',
      }),
    );

    assert.equal(url.pathname, '/admin/oauth/install_custom_app');
  });
});
