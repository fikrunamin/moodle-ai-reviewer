import type { Page } from "puppeteer-core";
import { moodleSelectors } from "./moodle-selectors";

export interface ScrapedInstructionFile {
  url: string;
  filename: string;
  kind: "pdf" | "docx" | "other";
}

export interface ScrapedAssignmentStudent {
  studentName: string;
  email?: string | null;
  submissionStatus?: string | null;
  submissionText?: string | null;
  submittedAt?: string | null;
  pdfUrls: Array<{ url: string; filename: string }>;
}

export interface ScrapedAdvancedRubricLevel {
  score: number;
  definition: string;
  selected: boolean;
}

export interface ScrapedAdvancedRubricCriterion {
  name: string;
  max_score: number;
  description: string;
  levels: ScrapedAdvancedRubricLevel[];
}

export interface ScrapedAdvancedRubric {
  source: "moodle_advanced_grading";
  rubric_summary: string;
  grading_instruction: string;
  feedback_format: string;
  criteria: ScrapedAdvancedRubricCriterion[];
}

export interface ScrapedAssignment {
  title: string;
  courseContext: string;
  instruction: string;
  instructionFiles: ScrapedInstructionFile[];
  students: ScrapedAssignmentStudent[];
}

export class MoodleAssignmentScraper {
  async scrapeOverview(
    page: Page,
  ): Promise<Pick<ScrapedAssignment, "title" | "instruction" | "courseContext" | "instructionFiles">> {
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

      // Collect attachment links from the intro / description / activity files area.
      const scopes = [
        "#intro",
        ".activity-description",
        ".assignmentintro",
        "[data-region='activity-information']",
        ".box.generalbox",
        "#region-main .no-overflow",
      ];
      const scopeEls = scopes
        .map((selector) => document.querySelector(selector))
        .filter((el): el is Element => Boolean(el));
      const searchRoots = scopeEls.length ? scopeEls : [document.querySelector("#region-main")].filter(Boolean) as Element[];

      const seen = new Set<string>();
      const instructionFiles: Array<{ url: string; filename: string; kind: "pdf" | "docx" | "other" }> = [];
      for (const root of searchRoots) {
        const anchors = Array.from(root.querySelectorAll("a[href]")) as HTMLAnchorElement[];
        for (const anchor of anchors) {
          const href = anchor.href;
          if (!href) continue;
          // Only Moodle file links or direct doc links.
          const isPluginFile = /pluginfile\.php/i.test(href) || /\/mod_assign\//i.test(href);
          const label = text(anchor) || href.split("/").pop() || "";
          const lowerHref = href.toLowerCase();
          const lowerLabel = label.toLowerCase();
          const isPdf = lowerHref.includes(".pdf") || lowerLabel.endsWith(".pdf");
          const isDocx = lowerHref.includes(".docx") || lowerLabel.endsWith(".docx");
          const isDoc = lowerHref.includes(".doc") || lowerLabel.endsWith(".doc");
          if (!isPdf && !isDocx && !isDoc && !(isPluginFile && /\.(pdf|docx?|odt)/i.test(href))) continue;
          if (seen.has(href)) continue;
          seen.add(href);
          const decoded = decodeURIComponent(label || href.split("/").pop() || "instruksi");
          instructionFiles.push({
            url: href,
            filename: decoded,
            kind: isPdf ? "pdf" : isDocx ? "docx" : "other",
          });
        }
      }

      return { title, instruction, courseContext, instructionFiles };
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

  async findFirstGraderUrl(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href*='action=grader'], a[href*='action%3Dgrader']")) as HTMLAnchorElement[];
      return links.find((link) => link.href)?.href ?? null;
    });
  }

  async scrapeAdvancedRubric(page: Page): Promise<ScrapedAdvancedRubric | null> {
    return page.evaluate(() => {
      const clean = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";
      const text = (element: Element | null) => clean(element?.textContent);
      const lines = (element: Element | null) => {
        if (!element) return [];
        const raw = element instanceof HTMLElement ? element.innerText : element.textContent ?? "";
        return raw
          .split(/\n+/)
          .map((line) => clean(line))
          .filter(Boolean);
      };
      const parseScore = (value: string) => {
        const normalized = value.replace(/,/g, ".");
        const matches = Array.from(normalized.matchAll(/-?\d+(?:\.\d+)?/g));
        const score = Number(matches.at(-1)?.[0]);
        return Number.isFinite(score) ? score : null;
      };

      const root =
        document.querySelector("#rubric-advancedgrading") ||
        document.querySelector(".rubric-advancedgrading") ||
        document.querySelector("[id*='rubric-advancedgrading']") ||
        document.querySelector(".gradingform_rubric");
      const rows = Array.from((root ?? document).querySelectorAll("tr.criterion"));

      const criteria = rows
        .map((row, criterionIndex) => {
          const levelElements = Array.from(row.querySelectorAll("td.levels td.level"));
          if (levelElements.length === 0) return null;

          const descriptionCell = row.querySelector("td.description, th.description, .criteriondescription");
          const descriptionLines = lines(descriptionCell);
          const explicitName = text(
            descriptionCell?.querySelector(
              ".criterionname, .criterionshortname, .criterion-title, h3, h4, strong",
            ) ?? null,
          );
          const description = descriptionLines.join(" ");
          const name = explicitName || descriptionLines[0] || `Kriteria ${criterionIndex + 1}`;

          const levels = levelElements.map((level, levelIndex) => {
            const scoreText = text(level.querySelector(".score, .scorevalue, .levelscore"));
            const scoreCandidates = [
              scoreText,
              level.getAttribute("data-score") ?? "",
              level.getAttribute("aria-label") ?? "",
              level.getAttribute("title") ?? "",
              text(level),
            ].filter(Boolean);
            const parsedScore = scoreCandidates.map(parseScore).find((score): score is number => score !== null);
            const definitionText =
              text(level.querySelector(".definition, .leveldefinition, .leveldesc, .description")) ||
              clean(text(level).replace(scoreText, ""));
            return {
              score: parsedScore ?? levelIndex,
              definition: definitionText || `Level ${levelIndex + 1}`,
              selected:
                level.classList.contains("checked") ||
                Boolean(level.querySelector("input:checked")) ||
                level.getAttribute("aria-checked") === "true",
            };
          });
          const maxScore = Math.max(...levels.map((level) => level.score));

          return {
            name,
            max_score: Number.isFinite(maxScore) ? maxScore : levels.length - 1,
            description,
            levels,
          };
        })
        .filter((criterion): criterion is {
          name: string;
          max_score: number;
          description: string;
          levels: Array<{ score: number; definition: string; selected: boolean }>;
        } => Boolean(criterion));

      if (criteria.length === 0) return null;
      const totalScore = criteria.reduce((sum, criterion) => sum + criterion.max_score, 0);
      return {
        source: "moodle_advanced_grading" as const,
        rubric_summary: `Rubrik Moodle Advanced Grading: ${criteria.length} kriteria, total maksimum ${totalScore} poin.`,
        grading_instruction:
          "Nilai setiap kriteria menggunakan level Moodle yang paling sesuai dengan bukti submission. Jangan membuat kriteria di luar rubrik Moodle.",
        feedback_format: "Berikan ringkasan dan feedback akademik singkat yang menjelaskan alasan skor per kriteria.",
        criteria,
      };
    });
  }

  async scrapeGrading(page: Page): Promise<ScrapedAssignmentStudent[]> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const rows = Array.from(document.querySelectorAll("table tbody tr, tr")).filter((row) => row.textContent?.trim());

      return rows
        .map((row) => {
          const rowText = text(row);
          // Moodle grading table: the student name lives in the c2 cell.
          const nameCell = row.querySelector("td.cell.c2");
          const nameLink = row.querySelector("a[href*='user/view'], a[href*='profile']");
          const studentName =
            text(nameCell?.querySelector("a") ?? null) ||
            text(nameCell) ||
            text(nameLink) ||
            text(row.querySelector("td")) ||
            "";
          const email =
            text(row.querySelector("td.cell.c3")) ||
            rowText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
            null;
          const pdfUrls = Array.from(row.querySelectorAll("a[href]"))
            .map((link) => {
              const anchor = link as HTMLAnchorElement;
              const href = anchor.href;
              const label = text(anchor);
              const lowerHref = href.toLowerCase();
              const lowerLabel = label.toLowerCase();
              const isDoc =
                /\.(pdf|docx|doc)(\?|$)/i.test(lowerHref) ||
                /\.(pdf|docx|doc)$/i.test(lowerLabel) ||
                (/pluginfile\.php/i.test(href) && /\.(pdf|docx|doc)/i.test(href));
              if (!isDoc) return null;
              const filename = decodeURIComponent(label || href.split("/").pop()?.split("?")[0] || "submission");
              return { url: href, filename };
            })
            .filter(Boolean) as Array<{ url: string; filename: string }>;

          if (!studentName || studentName.length < 2) return null;
          return {
            studentName,
            email: email && /@/.test(email) ? email : null,
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
