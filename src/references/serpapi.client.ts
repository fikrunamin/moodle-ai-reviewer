import { logger } from "../shared/logger";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const API_URL = "https://serpapi.com/search.json";

interface SerpApiResult {
  title?: string;
  link?: string;
  snippet?: string;
}

function isPdfUrl(url: string | null) {
  return Boolean(url && (/\.pdf(?:[?#]|$)/i.test(url) || /[?&]download=1/i.test(url)));
}

function toCandidate(result: SerpApiResult): ReferenceCandidate {
  const candidate = emptyCandidate("serpapi");
  candidate.title = result.title ?? null;
  candidate.url = result.link ?? null;
  candidate.pdfUrl = isPdfUrl(result.link ?? null) ? result.link ?? null : null;
  candidate.snippet = result.snippet ? result.snippet.slice(0, 400) : null;
  candidate.authority = authorityForUrl(candidate.url);
  candidate.raw = result;
  return candidate;
}

export async function searchSerpApi(query: string, limit = 8): Promise<ReferenceCandidate[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!apiKey || !normalized) return [];

  const params = new URLSearchParams({
    engine: "google",
    q: normalized,
    num: String(limit),
    api_key: apiKey,
  });

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: { "User-Agent": "MoodleAIReviewer/0.3" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`SerpAPI search HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { organic_results?: SerpApiResult[] };
    return Array.isArray(data.organic_results) ? data.organic_results.map(toCandidate) : [];
  } catch (error) {
    logger.warn("SerpAPI search failed", error);
    return [];
  }
}
