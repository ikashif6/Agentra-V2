let groqClient = null;

function getGroqClient() {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const OpenAI = require('openai');
  groqClient = new OpenAI({
    apiKey,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  });
  return groqClient;
}

function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function groqChat({ messages, model, temperature = 0.4, maxTokens = 1200 }) {
  const client = getGroqClient();
  if (!client) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  const response = await client.chat.completions.create({
    model: model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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
      model: process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 32,
      messages: [
        {
          role: 'system',
          content:
            'Classify the customer message into one intent: order_status, refund, cancel, product_search, policy, human_handoff, greeting, general. Reply with only the intent slug.',
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
    model: model || process.env.GROQ_FAST_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
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
