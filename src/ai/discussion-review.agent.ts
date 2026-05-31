import { AiProviderService } from "./ai-provider.service";
import {
  buildDiscussionPrompt,
  buildForumReferenceRelevancePrompt,
  buildForumReplySuggestionPrompt,
} from "./prompt-builder";

export class DiscussionReviewAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async review(input: {
    courseContext?: string | null;
    rubricGuide?: string | null;
    prompt: string;
    posts: string;
    tutorReplies?: string | null;
    interactionCount: number;
    ratingMax?: number | null;
  }) {
    return this.provider.getClient().completeJson(buildDiscussionPrompt(input), {
      timeoutMs: Number(process.env.REVIEW_AI_TIMEOUT_MS ?? 300_000),
    });
  }

  async suggestReply(input: {
    courseContext?: string | null;
    prompt: string;
    studentPosts: string;
    tutorReplies?: string | null;
    assessmentSummary?: string | null;
    referenceAnalysis?: string | null;
  }) {
    return this.provider.getClient().completeJson(buildForumReplySuggestionPrompt(input), {
      timeoutMs: Number(process.env.REVIEW_AI_TIMEOUT_MS ?? 300_000),
    });
  }

  async analyzeReferenceRelevance(input: {
    prompt: string;
    studentPosts: string;
    referenceRawText: string;
    resolvedMetadata?: string | null;
  }) {
    return this.provider.getClient().completeJson(buildForumReferenceRelevancePrompt(input), {
      timeoutMs: Number(process.env.REVIEW_AI_TIMEOUT_MS ?? 300_000),
    });
  }
}
