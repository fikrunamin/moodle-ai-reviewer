import { launchBrowser } from "../browser/puppeteer-client";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { ForumRepository } from "../database/repositories/forum.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { extractDocumentText } from "../pdf/document-extractor";
import { convertDocxToPdf } from "../pdf/docx-to-pdf";
import { logger } from "../shared/logger";
import { MoodleAssignmentScraper, type ScrapedAdvancedRubric } from "./moodle-assignment.scraper";
import { MoodleAuthService } from "./moodle-auth.service";
import { MoodleDiscussionScraper, type ScrapedDiscussionPost } from "./moodle-discussion.scraper";
import { MoodleDownloadService } from "./moodle-download.service";
import { extractPdfEnrichmentsJob } from "../jobs/extract-pdf-enrichments.job";
import { analyzeInstructionFilesJob } from "../jobs/analyze-instruction-files.job";
import { enrichmentQueue } from "../jobs/queues";
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

function ownerStudentPost(
  post: ScrapedDiscussionPost,
  byPostId: Map<string, ScrapedDiscussionPost>,
  firstPostId: string | null,
): ScrapedDiscussionPost | null {
  if (post.isFirstPost || post.authorRole === "system") return null;
  if (post.authorRole === "student") {
    let owner = post;
    let current = post;
    const seen = new Set<string>();
    while (current.parentMoodlePostId && !seen.has(current.parentMoodlePostId)) {
      seen.add(current.parentMoodlePostId);
      if (current.parentMoodlePostId === firstPostId) return owner;
      const parent = byPostId.get(current.parentMoodlePostId);
      if (!parent) break;
      if (parent.authorRole === "student") owner = parent;
      current = parent;
    }
    return owner;
  }

  let current: ScrapedDiscussionPost | undefined = post;
  const seen = new Set<string>();
  while (current?.parentMoodlePostId && !seen.has(current.parentMoodlePostId)) {
    seen.add(current.parentMoodlePostId);
    const parent = byPostId.get(current.parentMoodlePostId);
    if (!parent) break;
    if (parent.authorRole === "student") return ownerStudentPost(parent, byPostId, firstPostId) ?? parent;
    current = parent;
  }
  return null;
}

export class MoodleSyncService {
  private readonly activities = new ActivityRepository();
  private readonly assessments = new AssessmentRepository();
  private readonly forum = new ForumRepository();
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
        this.activities.updateScrapedContent(activityId, {
          title: scraped.title,
          prompt: scraped.prompt,
          courseContext: scraped.courseContext,
        });
        this.forum.clearActivity(activityId);
        const existingDiscussionStudents = this.students.listByActivity(activityId);
        if (existingDiscussionStudents.length) {
          this.students.deleteMany(existingDiscussionStudents.map((item) => item.id));
        }

        const firstPost = scraped.posts.find((post) => post.isFirstPost) ?? null;
        const byPostId = new Map(scraped.posts.map((post) => [post.moodlePostId, post]));
        const ownerByPostId = new Map<string, ScrapedDiscussionPost>();
        const postsByOwnerName = new Map<string, ScrapedDiscussionPost[]>();

        for (const post of scraped.posts) {
          const owner = ownerStudentPost(post, byPostId, firstPost?.moodlePostId ?? null);
          if (!owner) continue;
          ownerByPostId.set(post.moodlePostId, owner);
          const list = postsByOwnerName.get(owner.studentName) ?? [];
          list.push(post);
          postsByOwnerName.set(owner.studentName, list);
        }

        const studentIdByOwnerName = new Map<string, string>();
        for (const [studentName, posts] of postsByOwnerName) {
          const studentPostCount = posts.filter((post) => post.authorRole === "student").length;
          const student = this.students.upsert({
            activityId,
            studentName,
            submissionStatus: studentPostCount > 0 ? "posted" : "missing",
            interactionCount: studentPostCount,
          });
          studentIdByOwnerName.set(studentName, student.id);
        }

        for (const post of scraped.posts) {
          const owner = ownerByPostId.get(post.moodlePostId);
          const studentId = owner ? studentIdByOwnerName.get(owner.studentName) ?? null : null;
          this.forum.addPost({
            activityId,
            studentId,
            moodlePostId: post.moodlePostId,
            parentMoodlePostId: post.parentMoodlePostId ?? null,
            subject: post.subject ?? null,
            content: post.content,
            replyTo: post.replyTo ?? null,
            authorName: post.studentName,
            authorRole: post.authorRole,
            authorUserId: post.authorUserId ?? null,
            authorProfileUrl: post.authorProfileUrl ?? null,
            postedAt: post.postedAt ?? null,
            hasRatingMenu: post.hasRatingMenu,
            ratingMax: post.ratingMax ?? scraped.ratingMax ?? null,
            isFirstPost: post.isFirstPost,
          });
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
