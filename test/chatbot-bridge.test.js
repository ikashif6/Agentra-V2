/**
 * Smoke tests for Agentra ↔ Chatbot AI Agent bridge helpers.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  workspaceIdForCompany,
} = require('../src/services/chatbot-bridge/workspace-config.service');
const { isChatbotEngineEnabled } = require('../src/services/chatbot-bridge/bridge.service');

describe('chatbot-bridge workspace mapping', () => {
  it('uses subdomain as workspace id', () => {
    assert.equal(
      workspaceIdForCompany({ subdomain: 'acme', _id: '507f1f77bcf86cd799439011' }),
      'acme',
    );
  });

  it('falls back to company id when subdomain missing', () => {
    assert.equal(
      workspaceIdForCompany({ _id: '507f1f77bcf86cd799439011' }),
      '507f1f77bcf86cd799439011',
    );
  });
});

describe('chatbot-bridge enablement', () => {
  it('respects CHATBOT_ENGINE_ENABLED', () => {
    const prevEnabled = process.env.CHATBOT_ENGINE_ENABLED;
    const prevPipeline = process.env.AI_CONVERSATION_PIPELINE;
    process.env.CHATBOT_ENGINE_ENABLED = 'true';
    process.env.AI_CONVERSATION_PIPELINE = 'v2';
    try {
      assert.equal(isChatbotEngineEnabled({}), true);
    } finally {
      process.env.CHATBOT_ENGINE_ENABLED = prevEnabled;
      process.env.AI_CONVERSATION_PIPELINE = prevPipeline;
    }
  });

  it('respects AI_CONVERSATION_PIPELINE=chatbot', () => {
    const prevEnabled = process.env.CHATBOT_ENGINE_ENABLED;
    const prevPipeline = process.env.AI_CONVERSATION_PIPELINE;
    process.env.CHATBOT_ENGINE_ENABLED = 'false';
    process.env.AI_CONVERSATION_PIPELINE = 'chatbot';
    try {
      assert.equal(isChatbotEngineEnabled({}), true);
    } finally {
      process.env.CHATBOT_ENGINE_ENABLED = prevEnabled;
      process.env.AI_CONVERSATION_PIPELINE = prevPipeline;
    }
  });
});
