import type { Hono } from "hono";
import { z } from "zod";
import { PdfSummaryRepository } from "../database/repositories/pdf-summary.repository";
import { ExtractedLinkRepository } from "../database/repositories/extracted-link.repository";
import { ReferenceRepository } from "../database/repositories/reference.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { aiQueue, enrichmentQueue, referenceQueue } from "../jobs/queues";
import { extractPdfEnrichmentsJob } from "../jobs/extract-pdf-enrichments.job";
import { summarizePdfJob } from "../jobs/summarize-pdf.job";
import { resolveReferenceJob } from "../jobs/resolve-reference.job";
import { logger } from "../shared/logger";
import type { ExtractedReference } from "../shared/types";

function serializeReference(reference: ExtractedReference) {
  let authors: string[] | null = null;
  if (reference.authors) {
    try {
      const parsed = JSON.parse(reference.authors);
      if (Array.isArray(parsed)) authors = parsed.map((item) => String(item));
    } catch {
      authors = null;
    }
  }
  let metadata: unknown = null;
  if (reference.resolved_metadata_json) {
    try {
      metadata = JSON.parse(reference.resolved_metadata_json);
    } catch {
      metadata = null;
    }
  }
  return {
    ...reference,
    authors,
    resolved_metadata: metadata,
  };
}

function serializeSummary(summary: ReturnType<PdfSummaryRepository["findByFile"]>) {
  if (!summary) return null;
  let bullets: string[] = [];
  if (summary.bullet_points) {
    try {
      const parsed = JSON.parse(summary.bullet_points);
      if (Array.isArray(parsed)) bullets = parsed.map((item) => String(item));
    } catch {
      bullets = [];
    }
  }
  return { ...summary, bullet_points: bullets };
}

export function registerPdfRoutes(app: Hono) {
  // PDF summary
  app.get("/api/files/:fileId/summary", (c) => {
    const summary = new PdfSummaryRepository().findByFile(c.req.param("fileId"));
    return c.json(serializeSummary(summary));
  });

  app.post("/api/files/:fileId/summarize", async (c) => {
    const fileId = c.req.param("fileId");
    let body: { force?: boolean } = {};
    try {
      body = z.object({ force: z.boolean().optional() }).parse(await c.req.json().catch(() => ({})));
    } catch {
      body = {};
    }
    try {
      const summary = await summarizePdfJob({ fileId, force: body.force });
      return c.json(serializeSummary(summary));
    } catch (error) {
      logger.error("Summarize PDF route failed", error);
      return c.json(
        { error: error instanceof Error ? error.message : "Summarize failed" },
        502,
      );
    }
  });

  // Submission links
  app.get("/api/submissions/:submissionId/links", (c) => {
    const links = new ExtractedLinkRepository().listBySubmission(c.req.param("submissionId"));
    return c.json(links);
  });

  app.post("/api/submissions/:submissionId/links/refresh", (c) => {
    const submissionId = c.req.param("submissionId");
    enrichmentQueue.enqueue(() =>
      extractPdfEnrichmentsJob({ submissionId, parseReferences: false }),
    );
    return c.json({ queued: true, queue: enrichmentQueue.getStatus() });
  });

  // Submission references
  app.get("/api/submissions/:submissionId/references", (c) => {
    const refs = new ReferenceRepository().listBySubmission(c.req.param("submissionId"));
    return c.json(refs.map(serializeReference));
  });

  app.post("/api/submissions/:submissionId/references/refresh", (c) => {
    const submissionId = c.req.param("submissionId");
    enrichmentQueue.enqueue(() =>
      extractPdfEnrichmentsJob({ submissionId, parseReferences: true }),
    );
    return c.json({ queued: true, queue: enrichmentQueue.getStatus() });
  });

  // Single reference
  app.post("/api/references/:refId/resolve", (c) => {
    const refId = c.req.param("refId");
    referenceQueue.enqueue(() => resolveReferenceJob(refId));
    return c.json({ queued: true, queue: referenceQueue.getStatus() });
  });

  // Submission helper to derive submissionId from studentId for the UI
  app.get("/api/students/:studentId/submission", (c) => {
    const submission = new SubmissionRepository().findByStudent(c.req.param("studentId"));
    return c.json(submission);
  });

  app.get("/api/jobs/enrichment", (c) => c.json(enrichmentQueue.getStatus()));
  app.get("/api/jobs/reference", (c) => c.json(referenceQueue.getStatus()));

  void aiQueue;
}
