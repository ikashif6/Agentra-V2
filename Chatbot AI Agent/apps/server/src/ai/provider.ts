export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiCompletion {
  text?: string;
  toolCalls?: AiToolCall[];
  raw?: unknown;
}

export interface AiProvider {
  complete(input: {
    messages: AiMessage[];
    tools?: AiToolSpec[];
    temperature?: number;
  }): Promise<AiCompletion>;
}
