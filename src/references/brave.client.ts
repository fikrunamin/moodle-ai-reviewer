import { logger } from "../shared/logger";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const API_URL = "https://api.search.brave.com/res/v1/web/search";

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string | null;
}

function isPdfUrl(url: string | null) {
  return Boolean(url && (/\.pdf(?:[?#]|$)/i.test(url) || /[?&]download=1/i.test(url)));
}

function toCandidate(result: BraveResult): ReferenceCandidate {
  const candidate = emptyCandidate("brave");
  candidate.title = result.title ?? null;
  candidate.url = result.url ?? null;
  candidate.pdfUrl = isPdfUrl(result.url ?? null) ? result.url ?? null : null;
  candidate.snippet = result.description ? result.description.slice(0, 400) : null;
  candidate.year = result.page_age ? Number(result.page_age.slice(0, 4)) || null : null;
  candidate.authority = authorityForUrl(candidate.url);
  candidate.raw = result;
  return candidate;
}

export async function searchBrave(query: string, limit = 6): Promise<ReferenceCandidate[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!apiKey || !normalized) return [];

  const params = new URLSearchParams({ q: normalized, count: String(limit) });

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`Brave search HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { web?: { results?: BraveResult[] } };
    return Array.isArray(data.web?.results) ? data.web!.results!.map(toCandidate) : [];
  } catch (error) {
    logger.warn("Brave search failed", error);
    return [];
  }
}
