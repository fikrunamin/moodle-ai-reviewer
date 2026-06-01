import { AiProviderService } from "./ai-provider.service";
import { buildReferenceSearchPlanPrompt } from "./prompt-builder";
import { logger } from "../shared/logger";

export interface ReferenceSearchPlan {
  intent: "academic" | "pdf_document" | "general" | "technical" | "news";
  is_academic: boolean;
  language: string;
  queries: string[];
  pdf_queries: string[];
  expected_doi: string | null;
  expected_arxiv_id: string | null;
  title_guess: string | null;
}

export interface PlannerInput {
  rawText: string;
  title?: string | null;
  authors?: string[] | null;
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  arxivId?: string | null;
  contextText?: string | null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function stringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, max);
}

/**
 * Deterministic fallback plan when the AI planner is unavailable or fails.
 * Builds queries from known metadata + raw citation text.
 */
export function fallbackSearchPlan(input: PlannerInput): ReferenceSearchPlan {
  const titleOrRaw = (input.title ?? input.rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
  const firstAuthor = input.authors?.[0] ?? "";
  const yearPart = input.year ? String(input.year) : "";
  const quoted = titleOrRaw ? `"${titleOrRaw}"` : "";

  const queries = Array.from(
    new Set(
      [
        [quoted, firstAuthor, yearPart].filter(Boolean).join(" "),
        [titleOrRaw, firstAuthor].filter(Boolean).join(" "),
        titleOrRaw,
      ]
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).slice(0, 5);

  const topic = titleOrRaw;
  const pdfQueries = topic
    ? [
        `"${topic}" filetype:pdf`,
        `site:ac.id filetype:pdf ${topic}`,
        `site:edu filetype:pdf ${topic}`,
        `site:go.id filetype:pdf ${topic}`,
        `site:org filetype:pdf ${topic}`,
      ]
    : [];

  return {
    intent: input.arxivId || input.doi ? "academic" : "general",
    is_academic: Boolean(input.arxivId || input.doi || input.title),
    language: "id",
    queries: queries.length ? queries : topic ? [topic] : [],
    pdf_queries: pdfQueries,
    expected_doi: input.doi ?? null,
    expected_arxiv_id: input.arxivId ?? null,
    title_guess: input.title ?? (titleOrRaw || null),
  };
}

export class ReferenceSearchPlannerAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async plan(input: PlannerInput): Promise<ReferenceSearchPlan> {
    if (process.env.REFERENCE_SEARCH_PLANNER_ENABLED === "false") {
      return fallbackSearchPlan(input);
    }

    try {
      const result = (await this.provider.getClient().completeJson(buildReferenceSearchPlanPrompt(input), {
        timeoutMs: Number(process.env.REFERENCE_SEARCH_PLAN_TIMEOUT_MS ?? 60_000),
      })) as Record<string, unknown>;

      const fallback = fallbackSearchPlan(input);
      const intent = cleanString(result.intent) as ReferenceSearchPlan["intent"] | null;
      const queries = stringArray(result.queries, 5);
      const pdfQueries = stringArray(result.pdf_queries, 6);

      return {
        intent: intent ?? fallback.intent,
        is_academic: typeof result.is_academic === "boolean" ? result.is_academic : fallback.is_academic,
        language: cleanString(result.language) ?? fallback.language,
        queries: queries.length ? queries : fallback.queries,
        pdf_queries: pdfQueries.length ? pdfQueries : fallback.pdf_queries,
        expected_doi: cleanString(result.expected_doi) ?? fallback.expected_doi,
        expected_arxiv_id: cleanString(result.expected_arxiv_id) ?? fallback.expected_arxiv_id,
        title_guess: cleanString(result.title_guess) ?? fallback.title_guess,
      };
    } catch (error) {
      logger.warn("Reference search planner failed, using fallback plan", error);
      return fallbackSearchPlan(input);
    }
  }
}
