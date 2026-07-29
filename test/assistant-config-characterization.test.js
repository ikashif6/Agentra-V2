/**
 * Characterization tests for owner AI configuration merge behavior.
 * These lock existing semantics before the config-aware engine lands.
 * Run: node --test test/assistant-config-characterization.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveChannelAiConfig,
  getAiAgentConfig,
  isChannelAiEnabled,
  updateAiAgentConfig,
} = require('../src/services/ai-agent-config.service');
const { defaultPermissions, canPerform } = require('../src/services/live-chat-permissions.service');
const { moneyObject } = require('../src/services/live-chat-money.service');

function fakeCompany(overrides = {}) {
  return {
    name: 'Test Store',
    currency: 'USD',
    timezone: 'UTC',
    locale: 'en',
    liveChat: {
      enabled: true,
      content: { agentName: 'Test Bot' },
      behavior: {
        requireOrderVerification: true,
        handoffOnlyInBusinessHours: true,
      },
      ai: {
        enabled: true,
        instructions: 'Shared store voice. Be warm and brief.',
        escalationKeywords: ['talk to a human'],
        allowedActions: {
          lookupOrder: true,
          cancelOrder: false,
          refundOrder: true,
          maxRefundAmount: 100,
          editOrder: false,
          productRecommendations: true,
          requestHuman: true,
        },
      },
    },
    aiAgent: {
      enabledChannels: {
        liveChat: true,
        email: false,
        facebook: false,
        instagram: false,
        whatsapp: false,
        tiktok: false,
      },
      channelOverrides: {},
    },
    settings: { businessHours: { enabled: false } },
    storeIntegration: { status: 'connected', provider: 'shopify' },
    markModified() {},
    async save() {
      return this;
    },
    ...overrides,
  };
}

describe('channel AI config merge (characterization)', () => {
  it('uses shared defaults when no channel override exists', () => {
    const company = fakeCompany();
    const cfg = resolveChannelAiConfig(company, 'liveChat');
    assert.equal(cfg.instructions, 'Shared store voice. Be warm and brief.');
    assert.equal(cfg.allowedActions.lookupOrder, true);
    assert.equal(cfg.allowedActions.maxRefundAmount, 100);
    assert.equal(cfg.allowedActions.cancelOrder, false);
    assert.match(cfg.styleGuidance, /live chat/i);
  });

  it('applies live-chat instruction override without changing shared defaults object', () => {
    const company = fakeCompany({
      aiAgent: {
        enabledChannels: { liveChat: true },
        channelOverrides: {
          liveChat: {
            instructions: 'Vastora bridal tone. Warm and formal.',
          },
        },
      },
    });
    const live = resolveChannelAiConfig(company, 'liveChat');
    const email = resolveChannelAiConfig(company, 'email');
    assert.equal(live.instructions, 'Vastora bridal tone. Warm and formal.');
    assert.equal(email.instructions, 'Shared store voice. Be warm and brief.');
  });

  it('merges sparse action overrides over shared defaults', () => {
    const company = fakeCompany({
      aiAgent: {
        enabledChannels: { liveChat: true },
        channelOverrides: {
          liveChat: {
            allowedActions: {
              productRecommendations: false,
              maxRefundAmount: 50,
            },
          },
        },
      },
    });
    const cfg = resolveChannelAiConfig(company, 'liveChat');
    assert.equal(cfg.allowedActions.productRecommendations, false);
    assert.equal(cfg.allowedActions.maxRefundAmount, 50);
    assert.equal(cfg.allowedActions.lookupOrder, true);
    assert.equal(cfg.allowedActions.refundOrder, true);
  });

  it('does not enable email AI unless channel flag is on', () => {
    const company = fakeCompany();
    assert.equal(isChannelAiEnabled(company, 'liveChat'), true);
    assert.equal(isChannelAiEnabled(company, 'email'), false);
  });

  it('getAiAgentConfig exposes defaults and overrides for settings UI', () => {
    const company = fakeCompany({
      aiAgent: {
        enabledChannels: { liveChat: true, email: true },
        channelOverrides: {
          email: { instructions: 'Email override' },
        },
      },
    });
    const cfg = getAiAgentConfig(company);
    assert.equal(cfg.defaults.instructions, 'Shared store voice. Be warm and brief.');
    assert.equal(cfg.channelOverrides.email.instructions, 'Email override');
    assert.equal(cfg.enabledChannels.email, true);
  });
});

describe('permissions characterization', () => {
  it('maps allowedActions into backend permission flags', () => {
    const perms = defaultPermissions({
      allowedActions: {
        productRecommendations: false,
        refundOrder: true,
        cancelOrder: true,
        editOrder: true,
        requestHuman: false,
        maxRefundAmount: 75,
      },
    });
    assert.equal(canPerform(perms, 'recommendProducts'), false);
    assert.equal(canPerform(perms, 'issueRefunds'), true);
    assert.equal(canPerform(perms, 'cancelOrders'), true);
    assert.equal(canPerform(perms, 'changeDeliveryAddress'), true);
    assert.equal(canPerform(perms, 'handoffToHuman'), false);
    assert.equal(perms.maxRefundAmount, 75);
  });

  it('keeps money normalization workspace-agnostic', () => {
    assert.equal(moneyObject(10000, 'USD').amount, '100');
    assert.equal(moneyObject(100, 'USD').display.includes('USD'), true);
  });
});

describe('settings save characterization', () => {
  it('updateAiAgentConfig writes shared defaults onto liveChat.ai', async () => {
    const company = fakeCompany();
    await updateAiAgentConfig(company, {
      defaults: {
        instructions: 'Updated shared voice',
        allowedActions: { maxRefundAmount: 200, cancelOrder: true },
      },
    });
    assert.equal(company.liveChat.ai.instructions, 'Updated shared voice');
    assert.equal(company.liveChat.ai.allowedActions.maxRefundAmount, 200);
    assert.equal(company.liveChat.ai.allowedActions.cancelOrder, true);
  });

  it('updateAiAgentConfig stores channel override sparsely', async () => {
    const company = fakeCompany();
    await updateAiAgentConfig(company, {
      channelOverrides: {
        liveChat: {
          instructions: 'Channel only',
          allowedActions: { productRecommendations: false },
        },
      },
    });
    const override = company.aiAgent.channelOverrides.liveChat;
    assert.equal(override.instructions, 'Channel only');
    assert.equal(override.allowedActions.productRecommendations, false);
    assert.equal(override.allowedActions.lookupOrder, undefined);
  });
});
