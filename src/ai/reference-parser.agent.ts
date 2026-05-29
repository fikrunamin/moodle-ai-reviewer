import { AiProviderService } from "./ai-provider.service";
import { buildReferenceParserPrompt } from "./prompt-builder";

export class ReferenceParserAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async parse(input: { rawText: string }) {
    const maxChars = Number(process.env.REFERENCE_PARSE_MAX_CHARS ?? 14000);
    const text = input.rawText ?? "";
    const truncated = text.length > maxChars;
    const trimmed = truncated ? text.slice(0, maxChars) : text;

    return this.provider.getClient().completeJson(
      buildReferenceParserPrompt({ rawText: trimmed, truncated }),
      { timeoutMs: Number(process.env.REFERENCE_PARSE_TIMEOUT_MS ?? 60_000) },
    );
  }
}
