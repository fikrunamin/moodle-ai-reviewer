import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { paths } from "../runtime/paths";

export class MoodleDownloadService {
  getSafeDownloadPath(activityId: string, studentId: string, filename: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(paths.downloads, `${activityId}_${studentId}_${safeName}`);
  }

  async downloadWithSession(page: Page, input: { url: string; activityId: string; studentId: string; filename: string }) {
    const response = await page.goto(input.url, { waitUntil: "networkidle2" });
    if (!response?.ok()) {
      throw new Error(`Download failed: ${response?.status() ?? "no response"}`);
    }

    const buffer = await response.buffer();
    const filePath = this.getSafeDownloadPath(input.activityId, input.studentId, input.filename);
    await Bun.write(filePath, buffer);
    return filePath;
  }
}
