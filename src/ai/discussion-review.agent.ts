import { AiProviderService } from "./ai-provider.service";
import { buildDiscussionPrompt } from "./prompt-builder";

export class DiscussionReviewAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async review(input: { courseContext?: string | null; rubricGuide?: string | null; prompt: string; posts: string; interactionCount: number }) {
    return this.provider.getClient().completeJson(buildDiscussionPrompt(input), {
      timeoutMs: Number(process.env.REVIEW_AI_TIMEOUT_MS ?? 180_000),
    });
  }
}
