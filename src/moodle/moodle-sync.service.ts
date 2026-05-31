import { launchBrowser } from "../browser/puppeteer-client";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { extractDocumentText } from "../pdf/document-extractor";
import { convertDocxToPdf } from "../pdf/docx-to-pdf";
import { logger } from "../shared/logger";
import { MoodleAssignmentScraper, type ScrapedAdvancedRubric } from "./moodle-assignment.scraper";
import { MoodleAuthService } from "./moodle-auth.service";
import { MoodleDiscussionScraper } from "./moodle-discussion.scraper";
import { MoodleDownloadService } from "./moodle-download.service";
import { extractPdfEnrichmentsJob } from "../jobs/extract-pdf-enrichments.job";
import { analyzeInstructionFilesJob } from "../jobs/analyze-instruction-files.job";
import { enrichmentQueue } from "../jobs/queues";
import { getDb } from "../database/db";
import { nanoid } from "nanoid";
import type { Browser, Page } from "puppeteer-core";
import type { MoodleActivity } from "../shared/types";

function assignmentMainUrl(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete("action");
  parsed.searchParams.delete("page");
  parsed.searchParams.delete("perpage");
  return parsed.href;
}

function assignmentGradingUrl(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("action", "grading");
  parsed.searchParams.set("page", "0");
  parsed.searchParams.set("perpage", "5000");
  return parsed.href;
}

function assignmentGraderUrl(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("action", "grader");
  parsed.searchParams.delete("page");
  parsed.searchParams.delete("perpage");
  return parsed.href;
}

function safeJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function shouldApplyMoodleRubric(activity: MoodleActivity | null) {
  if (!activity) return true;
  if (activity.rubric_file_path) return false;
  if (activity.rubric_extracted_text && !activity.rubric_ai_json) return false;
  const source = safeJsonObject(activity.rubric_ai_json)?.source;
  return !activity.rubric_ai_json || source === "instruction_document" || source === "moodle_advanced_grading";
}

function rubricToText(rubric: ScrapedAdvancedRubric) {
  return rubric.criteria
    .map((criterion) => {
      const levels = criterion.levels
        .map((level) => `- ${level.score}: ${level.definition}`)
        .join("\n");
      return `${criterion.name} (maks ${criterion.max_score})\n${criterion.description}\n${levels}`.trim();
    })
    .join("\n\n");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MoodleSyncService {
  private readonly activities = new ActivityRepository();
  private readonly assessments = new AssessmentRepository();
  private readonly students = new StudentRepository();
  private readonly submissions = new SubmissionRepository();
  private readonly downloader = new MoodleDownloadService();

  private async scrapeAdvancedRubricFromUrl(
    page: Page,
    scraper: MoodleAssignmentScraper,
    url: string,
  ) {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45_000 });
      await wait(3_000);
      return await scraper.scrapeAdvancedRubric(page);
    } catch (error) {
      logger.warn("Moodle advanced grading rubric scrape failed", error);
      return null;
    }
  }

  private updateRubricFromMoodle(activityId: string, rubric: ScrapedAdvancedRubric) {
    const current = this.activities.find(activityId);
    if (!shouldApplyMoodleRubric(current)) return;
    this.activities.updateRubric(activityId, {
      status: "ready",
      extractedText: rubricToText(rubric),
      aiJson: JSON.stringify(rubric),
      error: null,
    });
  }

  async syncActivity(activityId: string) {
    const activity = this.activities.find(activityId);
    if (!activity) throw new Error("Activity not found");

    this.activities.updateSyncStatus(activityId, "syncing");
    let browser: Browser | null = null;

    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await new MoodleAuthService().applyCookies(page);
      this.assessments.markActivityObsolete(activityId);
      this.submissions.clearMoodleDataForActivity(activityId);

      if (activity.type === "assignment") {
        const scraper = new MoodleAssignmentScraper();
        await page.goto(assignmentMainUrl(activity.url), { waitUntil: "networkidle2", timeout: 45_000 });
        const overview = await scraper.scrapeOverview(page);
        this.activities.updateScrapedContent(activityId, {
          title: overview.title,
          instruction: overview.instruction,
          courseContext: overview.courseContext,
        });

        // Download + extract + analyze any instruction documents (PDF/DOCX)
        // attached to the assignment description, while the session is open.
        if (overview.instructionFiles?.length) {
          try {
            await analyzeInstructionFilesJob({
              page,
              activityId,
              title: overview.title,
              htmlInstruction: overview.instruction,
              files: overview.instructionFiles,
            });
          } catch (error) {
            logger.warn("Instruction analysis failed", error);
          }
        }

        let advancedRubric = await this.scrapeAdvancedRubricFromUrl(
          page,
          scraper,
          assignmentGraderUrl(activity.url),
        );
        if (advancedRubric) this.updateRubricFromMoodle(activityId, advancedRubric);

        await page.goto(assignmentGradingUrl(activity.url), { waitUntil: "networkidle2", timeout: 45_000 });
        await scraper.showAllGradingRows(page);
        const students = await scraper.scrapeGrading(page);

        if (!advancedRubric) {
          const graderUrl = await scraper.findFirstGraderUrl(page);
          if (graderUrl) {
            advancedRubric = await this.scrapeAdvancedRubricFromUrl(page, scraper, graderUrl);
            if (advancedRubric) this.updateRubricFromMoodle(activityId, advancedRubric);
          }
        }

        for (const item of students) {
          const student = this.students.upsert({
            activityId,
            studentName: item.studentName,
            email: item.email,
            submissionStatus: item.submissionStatus,
          });

          let extractedText = "";
          const submissionId = this.submissions.upsert({
            activityId,
            studentId: student.id,
            submissionText: item.submissionText,
            extractedText: null,
            submittedAt: item.submittedAt,
          });

          for (const pdf of item.pdfUrls.slice(0, 5)) {
            let filePath: string | null = null;
            try {
              const destPath = this.downloader.getSafeDownloadPath(activityId, student.id, pdf.filename);
              filePath = await this.downloader.downloadFileWithSession(page, {
                url: pdf.url,
                destPath,
              });
            } catch (error) {
              logger.warn("Submission file download failed", error);
              continue;
            }

            // Record the file immediately so it shows in the UI even if text
            // extraction fails afterwards.
            let extractedTextPath: string | null = null;
            try {
              const extracted = await extractDocumentText(filePath);
              if (extracted.text.trim()) {
                extractedText += `\n\n${extracted.text}`;
                extractedTextPath = extracted.outputPath;
              }
            } catch (error) {
              logger.warn("Submission file extraction failed", error);
            }

            const lowerName = pdf.filename.toLowerCase();
            const isDocx = lowerName.endsWith(".docx");
            const mimeType = isDocx
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : lowerName.endsWith(".doc")
                ? "application/msword"
                : "application/pdf";

            // For DOCX, render a previewable PDF (LibreOffice) keeping images,
            // links, and layout intact.
            let previewPdfPath: string | null = null;
            if (isDocx) {
              try {
                previewPdfPath = await convertDocxToPdf(filePath);
              } catch (error) {
                logger.warn("DOCX to PDF preview conversion failed", error);
              }
            }

            this.submissions.addFile({
              submissionId,
              filename: pdf.filename,
              mimeType,
              filePath,
              previewPdfPath,
              extractedTextPath,
            });
          }

          if (extractedText.trim()) {
            this.submissions.upsert({
              activityId,
              studentId: student.id,
              submissionText: item.submissionText,
              extractedText,
              submittedAt: item.submittedAt,
            });
          }

          enrichmentQueue.enqueue(() =>
            extractPdfEnrichmentsJob({ submissionId, parseReferences: true }),
          );
        }
      } else {
        await page.goto(activity.url, { waitUntil: "networkidle2", timeout: 45_000 });
        const scraped = await new MoodleDiscussionScraper().scrape(page);
        this.activities.updateScrapedContent(activityId, { title: scraped.title, prompt: scraped.prompt });
        const db = getDb();
        db.query("DELETE FROM moodle_discussion_posts WHERE activity_id = ?").run(activityId);

        const grouped = new Map<string, typeof scraped.posts>();
        for (const post of scraped.posts) {
          const list = grouped.get(post.studentName) ?? [];
          list.push(post);
          grouped.set(post.studentName, list);
        }

        for (const [studentName, posts] of grouped) {
          const student = this.students.upsert({
            activityId,
            studentName,
            submissionStatus: posts.length > 0 ? "posted" : "missing",
            interactionCount: posts.length,
          });

          const insertPost = db.query(
            "INSERT INTO moodle_discussion_posts (id, activity_id, student_id, content, reply_to, author_name, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          );
          for (const post of posts) {
            insertPost.run(nanoid(), activityId, student.id, post.content, post.replyTo ?? null, post.studentName, post.postedAt ?? null);
          }
        }
      }

      this.activities.refreshCounts(activityId);
      this.activities.updateSyncStatus(activityId, "synced");
      return this.activities.find(activityId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      this.activities.updateSyncStatus(activityId, "failed", message);
      logger.error("Sync failed", error);
      return this.activities.find(activityId);
    } finally {
      await browser?.close().catch(() => null);
    }
  }
}
