import { ActivityRepository } from "../database/repositories/activity.repository";
import { ForumReferenceRepository, ForumRepository } from "../database/repositories/forum.repository";
import { DiscussionReviewAgent } from "../ai/discussion-review.agent";
import { logger } from "../shared/logger";

export async function analyzeForumReferenceRelevanceJob(referenceId: string) {
  const refs = new ForumReferenceRepository();
  const forum = new ForumRepository();
  const activities = new ActivityRepository();
  const reference = refs.find(referenceId);
  if (!reference) return;

  refs.setRelevanceStatus(referenceId, "analyzing");
  try {
    const activity = activities.find(reference.activity_id);
    const posts = forum.listStudentAuthoredPosts(reference.student_id);
    const analysis = await new DiscussionReviewAgent().analyzeReferenceRelevance({
      prompt: activity?.prompt ?? "",
      studentPosts: posts.map((post) => post.content).join("\n\n"),
      referenceRawText: reference.raw_text,
      resolvedMetadata: reference.resolved_metadata_json,
    });
    refs.setRelevance(referenceId, analysis);
    return refs.find(referenceId);
  } catch (error) {
    logger.error("Analyze forum reference relevance failed", error);
    refs.setRelevanceStatus(referenceId, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
