let aiClient = null;

function selectedProvider() {
  return String(process.env.HELPDESK_AI_PROVIDER || process.env.AI_PROVIDER || 'groq').toLowerCase();
}

function providerConfig() {
  if (selectedProvider() === 'openai') {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      fastModel: process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      keyName: 'OPENAI_API_KEY',
    };
  }
  return {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    fastModel: process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant',
    keyName: 'GROQ_API_KEY',
  };
}

function getGroqClient() {
  if (aiClient) return aiClient;
  const { apiKey, baseURL } = providerConfig();
  if (!apiKey) return null;
  const OpenAI = require('openai');
  aiClient = new OpenAI({
    apiKey,
    baseURL,
  });
  return aiClient;
}

function isGroqConfigured() {
  return Boolean(providerConfig().apiKey);
}

async function groqChat({ messages, model, temperature = 0.4, maxTokens = 1200 }) {
  const client = getGroqClient();
  if (!client) {
    throw new Error(`${providerConfig().keyName} is not configured`);
  }
  const response = await client.chat.completions.create({
    model: model || providerConfig().model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}

async function groqClassify(text) {
  const client = getGroqClient();
  if (!client) return 'general';
  try {
    const response = await client.chat.completions.create({
      model: providerConfig().fastModel,
      temperature: 0,
      max_tokens: 32,
      messages: [
        {
          role: 'system',
          content:
            'Classify the customer message into one intent: order_status, refund, cancel, product_search, policy, human_handoff, greeting, off_topic, general. Use off_topic for questions unrelated to this store (travel, hotels, news, other brands). Reply with only the intent slug.',
        },
        { role: 'user', content: String(text).slice(0, 500) },
      ],
    });
    const intent = response.choices?.[0]?.message?.content?.trim().toLowerCase() || 'general';
    return intent.replace(/[^a-z_]/g, '') || 'general';
  } catch {
    return 'general';
  }
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function groqJson({ messages, model, temperature = 0.2, maxTokens = 2000 }) {
  const content = await groqChat({
    messages,
    model: model || providerConfig().fastModel,
    temperature,
    maxTokens,
  });
  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error('AI returned invalid JSON');
  }
  return parsed;
}

module.exports = {
  isGroqConfigured,
  groqChat,
  groqClassify,
  groqJson,
  extractJsonObject,
};
