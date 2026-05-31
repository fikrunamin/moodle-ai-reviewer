import { AiProviderService } from "./ai-provider.service";
import { buildAssignmentPrompt } from "./prompt-builder";

export class AssignmentReviewAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async review(input: {
    courseContext?: string | null;
    instruction: string;
    rubricGuide?: string | null;
    rubricCriteria?: Array<{
      name: string;
      max_score: number;
      description?: string | null;
      levels?: Array<{ score: number; definition: string }>;
    }> | null;
    submissionText: string;
    extractedText?: string | null;
  }) {
    return this.provider.getClient().completeJson(buildAssignmentPrompt(input), {
      timeoutMs: Number(process.env.REVIEW_AI_TIMEOUT_MS ?? 300_000),
    });
  }
}
