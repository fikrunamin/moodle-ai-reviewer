import { launchBrowser } from "../browser/puppeteer-client";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { extractPdfText } from "../pdf/pdf-extractor";
import { logger } from "../shared/logger";
import { MoodleAssignmentScraper } from "./moodle-assignment.scraper";
import { MoodleAuthService } from "./moodle-auth.service";
import { MoodleDiscussionScraper } from "./moodle-discussion.scraper";
import { MoodleDownloadService } from "./moodle-download.service";
import { getDb } from "../database/db";
import { nanoid } from "nanoid";
import type { Browser } from "puppeteer-core";

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

export class MoodleSyncService {
  private readonly activities = new ActivityRepository();
  private readonly assessments = new AssessmentRepository();
  private readonly students = new StudentRepository();
  private readonly submissions = new SubmissionRepository();
  private readonly downloader = new MoodleDownloadService();

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

        await page.goto(assignmentGradingUrl(activity.url), { waitUntil: "networkidle2", timeout: 45_000 });
        await scraper.showAllGradingRows(page);
        const students = await scraper.scrapeGrading(page);

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
            try {
              const filePath = await this.downloader.downloadWithSession(page, {
                url: pdf.url,
                activityId,
                studentId: student.id,
                filename: pdf.filename,
              });
              const extracted = await extractPdfText(filePath);
              extractedText += `\n\n${extracted.text}`;
              this.submissions.addFile({
                submissionId,
                filename: pdf.filename,
                mimeType: "application/pdf",
                filePath,
                extractedTextPath: extracted.outputPath,
              });
            } catch (error) {
              logger.warn("PDF download or extraction failed", error);
            }
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
