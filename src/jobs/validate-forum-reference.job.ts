import { CitationValidationAgent } from "../ai/citation-validation.agent";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { ForumReferenceRepository, ForumRepository } from "../database/repositories/forum.repository";
import { logger } from "../shared/logger";
import type { ForumReference } from "../shared/types";

function parseAuthors(reference: Pick<ForumReference, "authors">): string[] | null {
  if (!reference.authors) return null;
  try {
    const parsed = JSON.parse(reference.authors);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function referenceInput(reference: ForumReference) {
  return {
    rawText: reference.raw_text,
    authors: parseAuthors(reference),
    year: reference.year,
    title: reference.title,
    source: reference.source,
    doi: reference.doi,
    url: reference.url,
    arxivId: reference.arxiv_id,
  };
}

export async function validateForumReferenceJob(referenceId: string) {
  const refs = new ForumReferenceRepository();
  const forum = new ForumRepository();
  const activities = new ActivityRepository();
  const reference = refs.find(referenceId);
  if (!reference) return null;

  refs.setValidationState(referenceId, "validating");
  try {
    const activity = activities.find(reference.activity_id);
    const firstPost = forum.firstPost(reference.activity_id);
    const posts = forum.listStudentAuthoredPosts(reference.student_id);
    const validation = await new CitationValidationAgent().validate({
      mode: "forum",
      courseContext: activity?.course_context,
      forumPrompt: activity?.prompt ?? firstPost?.content ?? "",
      studentText: posts.map((post) => post.content).join("\n\n"),
      reference: referenceInput(reference),
      resolvedMetadata: reference.resolved_metadata_json,
    });

    refs.setValidation({
      id: referenceId,
      validationStatus: validation.validation_status,
      claimSupport: validation.claim_support,
      metadataMatchScore: validation.metadata_match_score,
      sourceQualityScore: validation.source_quality_score,
      referenceType: validation.reference_type,
      matchedUrl: validation.matched_url,
      matchedDoi: validation.matched_doi,
      validation,
    });
    return refs.find(referenceId);
  } catch (error) {
    logger.error("Validate forum reference failed", error);
    refs.setValidationState(referenceId, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
