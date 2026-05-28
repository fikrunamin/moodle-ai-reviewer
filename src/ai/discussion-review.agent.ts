import { AiProviderService } from "./ai-provider.service";
import { buildDiscussionPrompt } from "./prompt-builder";

export class DiscussionReviewAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async review(input: { prompt: string; posts: string; interactionCount: number }) {
    return this.provider.getClient().completeJson(buildDiscussionPrompt(input));
  }
}
