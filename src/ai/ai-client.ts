export interface AiClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class AiClient {
  constructor(private readonly options: AiClientOptions) {}

  async completeJson(prompt: string) {
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
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
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned empty content");
    return typeof content === "string" ? JSON.parse(content) : content;
  }

  async testConnection() {
    const response = await fetch(`${this.options.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`AI connection failed: ${response.status}`);
    }

    return { ok: true };
  }
}
