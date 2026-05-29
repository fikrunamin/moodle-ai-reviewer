import { AiProviderService } from "./ai-provider.service";
import { buildPdfSummaryPrompt } from "./prompt-builder";

export class PdfSummaryAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async summarize(input: {
    filename?: string | null;
    courseContext?: string | null;
    instruction?: string | null;
    extractedText: string;
  }) {
    return this.provider.getClient().completeJson(
      buildPdfSummaryPrompt({
        filename: input.filename,
        courseContext: input.courseContext,
        instruction: input.instruction,
        extractedText: input.extractedText ?? "",
        truncated: false,
      }),
      { timeoutMs: Number(process.env.PDF_SUMMARY_TIMEOUT_MS ?? 180_000) },
    );
  }
}
