import { logger } from "../shared/logger";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const API_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string | null;
  score?: number;
}

function isPdfUrl(url: string | null) {
  return Boolean(url && (/\.pdf(?:[?#]|$)/i.test(url) || /[?&]download=1/i.test(url)));
}

function toCandidate(result: TavilyResult): ReferenceCandidate {
  const candidate = emptyCandidate("tavily");
  candidate.title = result.title ?? null;
  candidate.url = result.url ?? null;
  candidate.pdfUrl = isPdfUrl(result.url ?? null) ? result.url ?? null : null;
  candidate.snippet = result.content ? result.content.slice(0, 400) : null;
  candidate.year = result.published_date ? Number(result.published_date.slice(0, 4)) || null : null;
  candidate.authority = authorityForUrl(candidate.url);
  candidate.raw = result;
  return candidate;
}

export async function searchTavily(query: string, limit = 6): Promise<ReferenceCandidate[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!apiKey || !normalized) return [];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: normalized,
        max_results: limit,
        search_depth: process.env.TAVILY_SEARCH_DEPTH ?? "basic",
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`Tavily search HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { results?: TavilyResult[] };
    return Array.isArray(data.results) ? data.results.map(toCandidate) : [];
  } catch (error) {
    logger.warn("Tavily search failed", error);
    return [];
  }
}
