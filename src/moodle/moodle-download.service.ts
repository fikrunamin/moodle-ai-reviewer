import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { paths } from "../runtime/paths";

export class MoodleDownloadService {
  getSafeDownloadPath(activityId: string, studentId: string, filename: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(paths.downloads, `${activityId}_${studentId}_${safeName}`);
  }

  async downloadWithSession(page: Page, input: { url: string; activityId: string; studentId: string; filename: string }) {
    const cookies = await page.cookies(input.url);
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const userAgent = await page.browser().userAgent();

    const response = await fetch(input.url, {
      redirect: "follow",
      headers: {
        Cookie: cookieHeader,
        "User-Agent": userAgent,
        Accept: "application/pdf,application/octet-stream,*/*",
        Referer: page.url(),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error("Download returned HTML instead of PDF. Moodle session may be expired.");
    }

    const buffer = await response.arrayBuffer();
    const filePath = this.getSafeDownloadPath(input.activityId, input.studentId, input.filename);
    await Bun.write(filePath, buffer);
    return filePath;
  }

  // Download an arbitrary file (PDF or DOCX) to a destination path using the
  // logged-in Moodle session. Used for assignment instruction attachments.
  async downloadFileWithSession(
    page: Page,
    input: { url: string; destPath: string },
  ) {
    const cookies = await page.cookies(input.url);
    const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const userAgent = await page.browser().userAgent();

    const response = await fetch(input.url, {
      redirect: "follow",
      headers: {
        Cookie: cookieHeader,
        "User-Agent": userAgent,
        Accept:
          "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,*/*",
        Referer: page.url(),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error("Download returned HTML instead of a document. Moodle session may be expired.");
    }

    const buffer = await response.arrayBuffer();
    await Bun.write(input.destPath, buffer);
    return input.destPath;
  }
}
