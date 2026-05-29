import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { PdfSummaryRepository } from "../database/repositories/pdf-summary.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { PdfSummaryAgent } from "../ai/pdf-summary.agent";
import { logger } from "../shared/logger";
import type { PdfSummary } from "../shared/types";

export async function summarizePdfJob(input: {
  fileId: string;
  force?: boolean;
}): Promise<PdfSummary> {
  const summaries = new PdfSummaryRepository();
  const submissions = new SubmissionRepository();
  const activities = new ActivityRepository();

  const file = submissions.findFile(input.fileId);
  if (!file) throw new Error("File not found");

  const existing = summaries.findByFile(input.fileId);
  if (existing && existing.status === "completed" && !input.force) {
    return existing;
  }

  const submission = submissions.find(file.submission_id);
  const activity = submission ? activities.find(submission.activity_id) : null;

  let extractedText = "";
  if (file.extracted_text_path && existsSync(file.extracted_text_path)) {
    extractedText = await readFile(file.extracted_text_path, "utf8");
  }

  if (!extractedText.trim()) {
    summaries.setStatus(input.fileId, "failed", "Extracted text tidak tersedia untuk file ini.");
    throw new Error("Extracted text tidak tersedia untuk file ini.");
  }

  summaries.setStatus(input.fileId, "processing");
  try {
    const result = await new PdfSummaryAgent().summarize({
      filename: file.filename,
      courseContext: activity?.course_context ?? null,
      instruction: activity?.instruction ?? null,
      extractedText,
    });
    const bullets = Array.isArray(result?.bullet_points)
      ? result.bullet_points.map((item: unknown) => String(item)).filter(Boolean)
      : [];
    return summaries.upsertCompleted({
      fileId: input.fileId,
      summary: String(result?.summary ?? "").trim(),
      bulletPoints: bullets,
      language: result?.language ? String(result.language) : null,
      rawJson: result,
    });
  } catch (error) {
    logger.error("Summarize PDF failed", error);
    summaries.setStatus(
      input.fileId,
      "failed",
      error instanceof Error ? error.message : "Summarize failed",
    );
    throw error;
  }
}
