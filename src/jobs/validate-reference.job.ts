import { CitationValidationAgent } from "../ai/citation-validation.agent";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { ReferenceRepository } from "../database/repositories/reference.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { logger } from "../shared/logger";
import type { ExtractedReference } from "../shared/types";

function parseAuthors(reference: Pick<ExtractedReference, "authors">): string[] | null {
  if (!reference.authors) return null;
  try {
    const parsed = JSON.parse(reference.authors);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function referenceInput(reference: ExtractedReference) {
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

export async function validateReferenceJob(referenceId: string) {
  const refs = new ReferenceRepository();
  const submissions = new SubmissionRepository();
  const activities = new ActivityRepository();
  const reference = refs.find(referenceId);
  if (!reference) return null;

  refs.setValidationState(referenceId, "validating");
  try {
    const submission = submissions.find(reference.submission_id);
    if (!submission) throw new Error("Submission not found");
    const activity = activities.find(submission.activity_id);
    const instruction = [activity?.instruction, activity?.instruction_brief, activity?.instruction_doc_text]
      .filter(Boolean)
      .join("\n\n");
    const studentText = [submission.submission_text, submission.extracted_text].filter(Boolean).join("\n\n");

    const validation = await new CitationValidationAgent().validate({
      mode: "assignment",
      courseContext: activity?.course_context,
      instruction,
      studentText,
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
    logger.error("Validate reference failed", error);
    refs.setValidationState(referenceId, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
