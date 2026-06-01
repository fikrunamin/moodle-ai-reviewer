import { logger } from "../shared/logger";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const API_URL = "https://api.openalex.org/works";

interface OpenAlexWork {
  title?: string | null;
  display_name?: string | null;
  doi?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: {
    landing_page_url?: string | null;
    pdf_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  open_access?: { oa_url?: string | null } | null;
  authorships?: Array<{ author?: { display_name?: string } }>;
  ids?: { openalex?: string };
}

function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const positions: Array<{ word: string; pos: number }> = [];
  for (const [word, locs] of Object.entries(index)) {
    for (const loc of locs) positions.push({ word, pos: loc });
  }
  if (!positions.length) return null;
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((item) => item.word).join(" ").slice(0, 1200);
}

function toCandidate(work: OpenAlexWork): ReferenceCandidate {
  const candidate = emptyCandidate("openalex");
  candidate.title = work.title ?? work.display_name ?? null;
  candidate.doi = work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//i, "") : null;
  candidate.year = typeof work.publication_year === "number" ? work.publication_year : null;
  candidate.citationCount = typeof work.cited_by_count === "number" ? work.cited_by_count : null;
  candidate.venue = work.primary_location?.source?.display_name ?? null;
  candidate.pdfUrl = work.primary_location?.pdf_url ?? work.open_access?.oa_url ?? null;
  candidate.url =
    work.primary_location?.landing_page_url ?? (candidate.doi ? `https://doi.org/${candidate.doi}` : null);
  candidate.authors = Array.isArray(work.authorships)
    ? work.authorships.map((item) => item.author?.display_name ?? "").filter(Boolean)
    : [];
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  candidate.abstract = abstract;
  candidate.snippet = abstract ? abstract.slice(0, 400) : null;
  candidate.authority = candidate.doi ? 90 : authorityForUrl(candidate.url);
  candidate.raw = work;
  return candidate;
}

export async function searchOpenAlex(query: string, limit = 5): Promise<ReferenceCandidate[]> {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized || process.env.OPENALEX_ENABLED === "false") return [];

  const params = new URLSearchParams({ search: normalized, per_page: String(limit) });
  const email = process.env.REFERENCE_CONTACT_EMAIL;
  if (email) params.set("mailto", email);

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers: { "User-Agent": `MoodleAIReviewer/0.3 (mailto:${email ?? "anonymous@example.com"})` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`OpenAlex search HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { results?: OpenAlexWork[] };
    return Array.isArray(data.results) ? data.results.map(toCandidate) : [];
  } catch (error) {
    logger.warn("OpenAlex search failed", error);
    return [];
  }
}
