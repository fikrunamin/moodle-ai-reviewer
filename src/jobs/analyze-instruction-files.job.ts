import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { MoodleDownloadService } from "../moodle/moodle-download.service";
import { extractDocumentText } from "../pdf/document-extractor";
import { InstructionAnalyzerAgent } from "../ai/instruction-analyzer.agent";
import { paths } from "../runtime/paths";
import { logger } from "../shared/logger";
import type { InstructionFile } from "../shared/types";

function safeName(activityId: string, filename: string) {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(paths.downloads, `instruction_${activityId}_${cleaned}`);
}

/**
 * Download instruction attachments (PDF/DOCX) found in the assignment
 * description, extract their text, and ask the AI to turn them into a
 * structured task brief. Runs while the Puppeteer session is still open.
 */
export async function analyzeInstructionFilesJob(input: {
  page: Page;
  activityId: string;
  title?: string | null;
  htmlInstruction?: string | null;
  files: InstructionFile[];
}) {
  const activities = new ActivityRepository();
  const downloader = new MoodleDownloadService();

  activities.updateInstructionFiles(input.activityId, input.files);

  const supported = input.files.filter((file) => file.kind === "pdf" || file.kind === "docx");
  if (supported.length === 0) return;

  const collected: string[] = [];
  for (const file of supported.slice(0, 5)) {
    try {
      const ext = file.kind === "docx" ? ".docx" : ".pdf";
      const named = /\.(pdf|docx)$/i.test(file.filename) ? file.filename : `${file.filename}${ext}`;
      const destPath = safeName(input.activityId, named);
      await downloader.downloadFileWithSession(input.page, { url: file.url, destPath });
      const extracted = await extractDocumentText(destPath);
      if (extracted.text.trim()) {
        collected.push(`### ${file.filename}\n${extracted.text.trim()}`);
      }
    } catch (error) {
      logger.warn("Instruction file download/extract failed", error);
    }
  }

  if (collected.length === 0) return;

  const documentText = collected.join("\n\n");
  activities.updateInstructionAnalysis(input.activityId, { docText: documentText });

  try {
    const analysis = await new InstructionAnalyzerAgent().analyze({
      title: input.title,
      htmlInstruction: input.htmlInstruction,
      documentText,
    });
    activities.updateInstructionAnalysis(input.activityId, {
      brief: JSON.stringify(analysis),
    });
  } catch (error) {
    logger.warn("Instruction analysis AI skipped or failed", error);
  }
}
