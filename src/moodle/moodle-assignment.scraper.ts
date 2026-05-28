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
  courseContext: string;
  instruction: string;
  students: ScrapedAssignmentStudent[];
}

export class MoodleAssignmentScraper {
  async scrapeOverview(page: Page): Promise<Pick<ScrapedAssignment, "title" | "instruction" | "courseContext">> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const title = text(document.querySelector(selectors.activityTitle)) || document.title || "Moodle Assignment";
      const breadcrumb = Array.from(document.querySelectorAll(".breadcrumb a, nav[aria-label='breadcrumb'] a, .breadcrumb-item a"))
        .map((element) => text(element))
        .filter(Boolean);
      const courseHeading =
        text(document.querySelector(".page-header-headings h1")) ||
        text(document.querySelector("h1")) ||
        document.title;
      const courseContext = Array.from(new Set([...breadcrumb, courseHeading])).join(" > ");
      const instruction =
        text(document.querySelector("#intro")) ||
        text(document.querySelector(".activity-description")) ||
        text(document.querySelector(".box.generalbox")) ||
        text(document.querySelector(selectors.regionMain));

      return { title, instruction, courseContext };
    }, moodleSelectors);
  }

  async showAllGradingRows(page: Page) {
    const perPageUrl = new URL(page.url());
    perPageUrl.searchParams.set("perpage", "5000");
    perPageUrl.searchParams.set("page", "0");
    await page.goto(perPageUrl.href, { waitUntil: "networkidle2", timeout: 45_000 }).catch(() => null);

    const selectInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const select = selects.find((item) => {
        const name = item.getAttribute("name")?.toLowerCase() ?? "";
        const id = item.getAttribute("id")?.toLowerCase() ?? "";
        return name.includes("perpage") || id.includes("perpage");
      }) as HTMLSelectElement | undefined;
      if (!select) return null;
      const options = Array.from(select.options)
        .map((option) => ({ value: option.value, label: option.textContent?.trim() ?? "" }))
        .filter((option) => option.value);
      const all = options.find((option) => /all|semua/i.test(option.label));
      const numeric = options
        .map((option) => ({ ...option, number: Number(option.value) }))
        .filter((option) => Number.isFinite(option.number))
        .sort((a, b) => b.number - a.number)[0];
      return { selector: select.name ? `select[name="${select.name}"]` : `#${select.id}`, value: all?.value ?? numeric?.value ?? null };
    });

    if (selectInfo?.value) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 }).catch(() => null),
        page.select(selectInfo.selector, selectInfo.value),
      ]);
    }
  }

  async scrapeGrading(page: Page): Promise<ScrapedAssignmentStudent[]> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const rows = Array.from(document.querySelectorAll("table tbody tr, tr")).filter((row) => row.textContent?.trim());

      return rows
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
    }, moodleSelectors);
  }
}
