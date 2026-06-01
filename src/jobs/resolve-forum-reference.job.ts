import { ForumReferenceRepository } from "../database/repositories/forum.repository";
import { resolveReference } from "../references/reference-resolver";
import { logger } from "../shared/logger";
import type { ExtractedReference } from "../shared/types";
import { analyzeForumReferenceRelevanceJob } from "./analyze-forum-reference-relevance.job";
import { validateForumReferenceJob } from "./validate-forum-reference.job";

export async function resolveForumReferenceJob(referenceId: string) {
  const repo = new ForumReferenceRepository();
  const reference = repo.find(referenceId);
  if (!reference) return;

  repo.setResolveStatus(referenceId, "resolving");
  try {
    const outcome = await resolveReference({
      ...reference,
      submission_id: reference.student_id,
    } as ExtractedReference);
    repo.setResolved({
      id: referenceId,
      source: outcome.source,
      pdfPath: outcome.pdfPath,
      pdfUrl: outcome.pdfUrl,
      metadata: outcome.metadata,
    });
    if (!outcome.pdfPath && outcome.error) {
      repo.setResolveStatus(referenceId, "not_found", outcome.error);
    }
    await validateForumReferenceJob(referenceId).catch(() => null);
    await analyzeForumReferenceRelevanceJob(referenceId).catch(() => null);
  } catch (error) {
    logger.error("Resolve forum reference failed", error);
    repo.setResolveStatus(referenceId, "failed", error instanceof Error ? error.message : String(error));
    await validateForumReferenceJob(referenceId).catch(() => null);
    await analyzeForumReferenceRelevanceJob(referenceId).catch(() => null);
  }
}
