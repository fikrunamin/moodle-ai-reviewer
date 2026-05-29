import { ReferenceRepository } from "../database/repositories/reference.repository";
import { resolveReference } from "../references/reference-resolver";
import { logger } from "../shared/logger";

export async function resolveReferenceJob(referenceId: string) {
  const repo = new ReferenceRepository();
  const reference = repo.find(referenceId);
  if (!reference) return;

  repo.setResolveStatus(referenceId, "resolving");
  try {
    const outcome = await resolveReference(reference);
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
  } catch (error) {
    logger.error("Resolve reference failed", error);
    repo.setResolveStatus(
      referenceId,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}
