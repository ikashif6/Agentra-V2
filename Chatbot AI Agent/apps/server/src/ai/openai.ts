import { env } from "../config/env.js";
import type { AiCompletion, AiMessage, AiProvider, AiToolSpec } from "./provider.js";

function toOpenAiTools(tools?: AiToolSpec[]) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

async function openAiCompatible(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  tools?: AiToolSpec[];
  temperature?: number;
}): Promise<AiCompletion> {
  if (!input.apiKey) {
    throw new Error("AI API key is not configured");
  }
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.3,
  };
  const tools = toOpenAiTools(input.tools);
  if (tools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${input.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const msg = data.choices?.[0]?.message;
  const toolCalls = (msg?.tool_calls || []).map((tc: any) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function?.arguments || "{}");
    } catch {
      args = {};
    }
    return {
      id: tc.id || `call_${Math.random().toString(36).slice(2)}`,
      name: tc.function?.name || "",
      arguments: args,
    };
  });
  return {
    text: msg?.content || undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    raw: data,
  };
}

export function createAiProvider(): AiProvider {
  const provider = env.aiProvider;
  return {
    async complete({ messages, tools, temperature }) {
      if (provider === "openai") {
        return openAiCompatible({
          baseUrl: "https://api.openai.com/v1",
          apiKey: env.openaiApiKey,
          model: env.openaiModel,
          messages,
          tools,
          temperature,
        });
      }
      if (provider === "anthropic") {
        return anthropicComplete({ messages, tools, temperature });
      }
      return openAiCompatible({
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: env.groqApiKey,
        model: env.groqModel,
        messages,
        tools,
        temperature,
      });
    },
  };
}

async function anthropicComplete(input: {
  messages: AiMessage[];
  tools?: AiToolSpec[];
  temperature?: number;
}): Promise<AiCompletion> {
  if (!env.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const system = input.messages.find((m) => m.role === "system")?.content || "";
  const messages = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const body: Record<string, unknown> = {
    model: env.anthropicModel,
    max_tokens: 2048,
    temperature: input.temperature ?? 0.3,
    system,
    messages,
  };
  if (input.tools?.length) {
    body.tools = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const toolCalls = (data.content || [])
    .filter((c: any) => c.type === "tool_use")
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      arguments: c.input || {},
    }));
  const text = (data.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");
  return {
    text: text || undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    raw: data,
  };
}
