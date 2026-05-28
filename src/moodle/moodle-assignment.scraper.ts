import type { Page } from "puppeteer-core";
import { moodleSelectors } from "./moodle-selectors";

export interface ScrapedAssignmentStudent {
  studentName: string;
  email?: string | null;
  submissionStatus?: string | null;
  submissionText?: string | null;
  submittedAt?: string | null;
  pdfUrls: Array<{ url: string; filename: string }>;
}

export interface ScrapedAssignment {
  title: string;
  instruction: string;
  students: ScrapedAssignmentStudent[];
}

export class MoodleAssignmentScraper {
  async scrape(page: Page): Promise<ScrapedAssignment> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const title = text(document.querySelector(selectors.activityTitle)) || document.title || "Moodle Assignment";
      const instruction = text(document.querySelector(selectors.regionMain));
      const rows = Array.from(document.querySelectorAll("tr")).filter((row) => row.textContent?.trim());

      const students = rows
        .map((row) => {
          const rowText = text(row);
          const nameLink = row.querySelector("a[href*='user/view'], a[href*='profile']");
          const studentName = text(nameLink) || text(row.querySelector("td")) || "";
          const email = rowText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
          const pdfUrls = Array.from(row.querySelectorAll("a[href]"))
            .map((link) => {
              const anchor = link as HTMLAnchorElement;
              const href = anchor.href;
              const label = text(anchor);
              if (!href.toLowerCase().includes(".pdf") && !label.toLowerCase().endsWith(".pdf")) return null;
              return { url: href, filename: label || href.split("/").pop() || "submission.pdf" };
            })
            .filter(Boolean) as Array<{ url: string; filename: string }>;

          if (!studentName || studentName.length < 2) return null;
          return {
            studentName,
            email,
            submissionStatus: rowText.includes("Submitted") || rowText.includes("Terkirim") ? "submitted" : "unknown",
            submissionText: rowText,
            submittedAt: null,
            pdfUrls,
          };
        })
        .filter(Boolean) as ScrapedAssignmentStudent[];

      return {
        title,
        instruction,
        students: students.length > 0 ? students : [],
      };
    }, moodleSelectors);
  }
}
