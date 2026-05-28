export interface AiClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
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

  async completeJson(prompt: string) {
    const response = await this.fetch(`${this.options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw await this.providerError(response, "AI request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned empty content");
    return typeof content === "string" ? JSON.parse(content) : content;
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
