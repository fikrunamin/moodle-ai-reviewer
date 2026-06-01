import { nanoid } from "nanoid";
import { getDb } from "../db";
import type {
  ExtractedReference,
  ReferenceClaimSupport,
  ReferenceResolution,
  ReferenceResolveSource,
  ReferenceResolveStatus,
  ReferenceType,
  ReferenceValidationState,
  ReferenceValidationStatus,
} from "../../shared/types";

export interface ParsedReferenceInput {
  rawText: string;
  authors?: string[] | null;
  year?: number | null;
  title?: string | null;
  source?: string | null;
  doi?: string | null;
  url?: string | null;
  arxivId?: string | null;
}

export class ReferenceRepository {
  listBySubmission(submissionId: string): ExtractedReference[] {
    return getDb()
      .query(
        "SELECT * FROM extracted_references WHERE submission_id = ? ORDER BY created_at ASC",
      )
      .all(submissionId) as ExtractedReference[];
  }

  find(id: string): ExtractedReference | null {
    return (
      (getDb()
        .query("SELECT * FROM extracted_references WHERE id = ?")
        .get(id) as ExtractedReference | null) ?? null
    );
  }

  replaceForSubmission(submissionId: string, references: ParsedReferenceInput[]) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.query("DELETE FROM extracted_references WHERE submission_id = ?").run(submissionId);
      const insert = db.query(
        "INSERT INTO extracted_references (id, submission_id, raw_text, authors, year, title, source, doi, url, arxiv_id, parse_status, resolve_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', 'pending')",
      );
      for (const ref of references) {
        insert.run(
          nanoid(),
          submissionId,
          ref.rawText,
          ref.authors ? JSON.stringify(ref.authors) : null,
          ref.year ?? null,
          ref.title ?? null,
          ref.source ?? null,
          ref.doi ?? null,
          ref.url ?? null,
          ref.arxivId ?? null,
        );
      }
    });
    tx();
  }

  setResolveStatus(id: string, status: ReferenceResolveStatus, error: string | null = null) {
    getDb()
      .query(
        "UPDATE extracted_references SET resolve_status = ?, resolve_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(status, error, id);
  }

  setResolved(input: {
    id: string;
    source: ReferenceResolveSource;
    pdfPath: string | null;
    pdfUrl: string | null;
    metadata: unknown;
  }) {
    const status: ReferenceResolveStatus = input.pdfPath ? "found" : "not_found";
    getDb()
      .query(
        "UPDATE extracted_references SET resolve_status = ?, resolve_source = ?, resolved_pdf_path = ?, resolved_pdf_url = ?, resolved_metadata_json = ?, resolve_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(
        status,
        input.source,
        input.pdfPath,
        input.pdfUrl,
        JSON.stringify(input.metadata ?? null),
        input.id,
      );
  }

  setValidationState(id: string, state: ReferenceValidationState, error: string | null = null) {
    getDb()
      .query(
        "UPDATE extracted_references SET validation_state = ?, validation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(state, error, id);
  }

  setValidation(input: {
    id: string;
    validationStatus: ReferenceValidationStatus;
    claimSupport: ReferenceClaimSupport;
    metadataMatchScore: number;
    sourceQualityScore: number;
    referenceType: ReferenceType;
    matchedUrl: string | null;
    matchedDoi: string | null;
    validation: unknown;
  }) {
    getDb()
      .query(
        `UPDATE extracted_references
         SET validation_state = 'completed', validation_status = ?, claim_support = ?, metadata_match_score = ?,
             source_quality_score = ?, reference_type = ?, matched_url = ?, matched_doi = ?, validation_json = ?,
             validation_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        input.validationStatus,
        input.claimSupport,
        input.metadataMatchScore,
        input.sourceQualityScore,
        input.referenceType,
        input.matchedUrl,
        input.matchedDoi,
        JSON.stringify(input.validation ?? null),
        input.id,
      );
  }

  listPending(submissionId: string): ExtractedReference[] {
    return getDb()
      .query(
        "SELECT * FROM extracted_references WHERE submission_id = ? AND resolve_status IN ('pending','failed') ORDER BY created_at ASC",
      )
      .all(submissionId) as ExtractedReference[];
  }
}

export class ReferenceResolutionCache {
  get(cacheKey: string): ReferenceResolution | null {
    return (
      (getDb()
        .query("SELECT * FROM reference_resolutions WHERE cache_key = ?")
        .get(cacheKey) as ReferenceResolution | null) ?? null
    );
  }

  set(input: {
    cacheKey: string;
    source: ReferenceResolveSource;
    pdfPath: string | null;
    pdfUrl: string | null;
    metadata: unknown;
  }) {
    const db = getDb();
    db.query("DELETE FROM reference_resolutions WHERE cache_key = ?").run(input.cacheKey);
    db.query(
      "INSERT INTO reference_resolutions (cache_key, source, pdf_path, pdf_url, metadata_json) VALUES (?, ?, ?, ?, ?)",
    ).run(
      input.cacheKey,
      input.source,
      input.pdfPath,
      input.pdfUrl,
      JSON.stringify(input.metadata ?? null),
    );
  }
}
