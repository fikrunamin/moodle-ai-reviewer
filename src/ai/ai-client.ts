export interface AiClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function stripJsonFence(input: string): string {
  let text = input.trim();
  // Strip leading ``` or ```json (or any language tag) fences
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "");
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();
  }
  return text;
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError" || error.code === DOMException.TIMEOUT_ERR)
  );
}

function isTransientNetworkError(error: unknown) {
  const code = typeof error === "object" && error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    ["ECONNRESET", "EPIPE", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(code) ||
    message.includes("socket connection was closed") ||
    message.includes("connection reset") ||
    message.includes("fetch failed")
  );
}

function isRetriableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseJsonLoose(raw: string): unknown {
  const stripped = stripJsonFence(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    const candidate = extractFirstJsonObject(stripped);
    if (candidate) {
      return JSON.parse(candidate);
    }
    throw new Error(
      `AI provider returned non-JSON content: ${stripped.slice(0, 200)}`,
    );
  }
}

export class AiClient {
  constructor(private readonly options: AiClientOptions) {}

  private requestTimeoutMs() {
    return Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30_000);
  }

  private fetch(input: string, init: RequestInit = {}) {
    return fetch(input, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(this.requestTimeoutMs()),
    });
  }

  private async providerError(response: Response, prefix: string) {
    const text = await response.text().catch(() => "");
    const isHtml = /^\s*<!doctype html|^\s*<html/i.test(text);
    const detail = isHtml
      ? ": provider returned HTML. Check Base URL; OpenAI-compatible endpoints usually end with /v1"
      : text
        ? `: ${text.slice(0, 300)}`
        : "";
    return new Error(`${prefix}: ${response.status}${detail}`);
  }

  async completeJson(prompt: string, options: { timeoutMs?: number } = {}) {
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs();
    const retries = Math.max(0, Number(process.env.AI_REQUEST_RETRIES ?? 2));
    const body = JSON.stringify({
      model: this.options.model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    let response: Response | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        response = await this.fetch(`${this.options.baseUrl}/chat/completions`, {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.options.apiKey}`,
          },
          body,
        });
        if (response.ok || !isRetriableStatus(response.status) || attempt === retries) break;
      } catch (error) {
        if (isTimeoutError(error)) {
          throw new Error(
            `AI request timed out after ${Math.round(timeoutMs / 1000)} seconds. Coba generate ulang atau naikkan REVIEW_AI_TIMEOUT_MS.`,
          );
        }
        if (!isTransientNetworkError(error) || attempt === retries) {
          throw error;
        }
      }
      await delay(750 * (attempt + 1));
    }

    if (!response) throw new Error("AI request failed before receiving a response");
    if (!response.ok) {
      throw await this.providerError(response, "AI request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned empty content");
    if (typeof content !== "string") return content;
    return parseJsonLoose(content);
  }

  async testConnection() {
    const response = await this.fetch(`${this.options.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });

    if (response.ok) {
      return { ok: true, method: "models" };
    }

    if (response.status !== 404 && response.status !== 405) {
      throw await this.providerError(response, "AI connection failed");
    }

    const chatResponse = await this.fetch(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        max_tokens: 3,
      }),
    });

    if (!chatResponse.ok) {
      throw await this.providerError(chatResponse, "AI connection failed");
    }

    return { ok: true, method: "chat_completions" };
  }
}
