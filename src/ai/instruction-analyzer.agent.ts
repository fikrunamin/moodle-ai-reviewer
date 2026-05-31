import { AiProviderService } from "./ai-provider.service";
import { buildInstructionAnalysisPrompt } from "./prompt-builder";

export class InstructionAnalyzerAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async analyze(input: {
    title?: string | null;
    htmlInstruction?: string | null;
    documentText: string;
  }) {
    const maxChars = Number(process.env.INSTRUCTION_ANALYSIS_MAX_CHARS ?? 14000);
    const text = input.documentText ?? "";
    const truncated = text.length > maxChars;
    const trimmed = truncated ? text.slice(0, maxChars) : text;

    return this.provider.getClient().completeJson(
      buildInstructionAnalysisPrompt({
        title: input.title,
        htmlInstruction: input.htmlInstruction,
        documentText: trimmed,
        truncated,
      }),
      { timeoutMs: Number(process.env.INSTRUCTION_ANALYSIS_TIMEOUT_MS ?? 120_000) },
    );
  }
}
