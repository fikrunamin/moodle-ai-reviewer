import { AiProviderService } from "./ai-provider.service";
import { buildAssignmentPrompt } from "./prompt-builder";

export class AssignmentReviewAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async review(input: { instruction: string; submissionText: string; extractedText?: string | null }) {
    return this.provider.getClient().completeJson(buildAssignmentPrompt(input));
  }
}
