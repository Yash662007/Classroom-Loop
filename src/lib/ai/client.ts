/**
 * Provider-agnostic OpenAI-compatible chat client.
 * Works with OpenAI, Azure OpenAI gateways, OpenRouter, Together, local Ollama/LM Studio, etc.
 * Timeout, malformed-JSON guard and a single retry are built in.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  source: "llm";
  model: string;
}

/** Token accounting returned by OpenAI-compatible providers when they report usage. */
export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  model?: string;
}

export interface ChatJsonResult<T> {
  data: T;
  usage: ChatUsage | null;
  model: string;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

function chatUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed
    : `${trimmed}/chat/completions`;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chatJson<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  return (await chatJsonWithUsage<T>(messages, opts)).data;
}

/**
 * chatJson + the provider's usage accounting (when reported). Callers that
 * meter LLM spend use this variant; plain callers keep the simple signature.
 */
export async function chatJsonWithUsage<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatJsonResult<T>> {
  if (!isLlmConfigured()) {
    throw new LlmUnavailableError("No LLM provider configured");
  }
  const apiKey = process.env.OPENAI_API_KEY as string;
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const doFetch = async (): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(chatUrl(base), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 1200,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LlmUnavailableError(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return await res.text();
    } catch (err) {
      if (err instanceof LlmUnavailableError) throw err;
      throw new LlmUnavailableError(`LLM request failed: ${(err as Error).message}`, err);
    } finally {
      clearTimeout(timer);
    }
  };

  // One retry on transient failure.
  let raw: string;
  try {
    raw = await doFetch();
  } catch {
    raw = await doFetch();
  }

  let usage: ChatUsage | null = null;

  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const content = typeof parsed === "object" && parsed !== null && "choices" in parsed
      ? parsed.choices?.[0]?.message?.content
      : undefined;
    if (typeof parsed.usage?.prompt_tokens === "number" || typeof parsed.usage?.completion_tokens === "number") {
      usage = {
        promptTokens: parsed.usage.prompt_tokens ?? 0,
        completionTokens: parsed.usage.completion_tokens ?? 0,
        totalTokens: parsed.usage.total_tokens,
        model: parsed.model,
      };
    }
    if (typeof content !== "string" || !content.trim()) {
      throw new LlmUnavailableError("LLM returned no message content");
    }
    try {
      return { data: JSON.parse(content) as T, usage, model };
    } catch {
      // Tolerate fenced/prose-wrapped JSON.
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return { data: JSON.parse(match[0]) as T, usage, model };
      throw new LlmUnavailableError("LLM returned malformed JSON");
    }
  } catch (err) {
    if (err instanceof LlmUnavailableError) throw err;
    throw new LlmUnavailableError("LLM returned malformed output", err);
  }
}
