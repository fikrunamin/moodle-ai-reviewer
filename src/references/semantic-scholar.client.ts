import { logger } from "../shared/logger";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const API_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = "title,abstract,year,authors,venue,citationCount,externalIds,openAccessPdf,url";

interface SemanticScholarPaper {
  title?: string;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  citationCount?: number | null;
  url?: string | null;
  authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; ArXiv?: string } | null;
  openAccessPdf?: { url?: string } | null;
}

function toCandidate(paper: SemanticScholarPaper): ReferenceCandidate {
  const candidate = emptyCandidate("semantic_scholar");
  candidate.title = paper.title ?? null;
  candidate.abstract = paper.abstract ?? null;
  candidate.year = typeof paper.year === "number" ? paper.year : null;
  candidate.venue = paper.venue ?? null;
  candidate.citationCount = typeof paper.citationCount === "number" ? paper.citationCount : null;
  candidate.doi = paper.externalIds?.DOI ?? null;
  candidate.arxivId = paper.externalIds?.ArXiv ?? null;
  candidate.pdfUrl = paper.openAccessPdf?.url ?? null;
  candidate.url = paper.url ?? (candidate.doi ? `https://doi.org/${candidate.doi}` : null);
  candidate.authors = Array.isArray(paper.authors)
    ? paper.authors.map((author) => author?.name ?? "").filter(Boolean)
    : [];
  candidate.snippet = paper.abstract ? paper.abstract.slice(0, 400) : null;
  candidate.authority = candidate.doi ? 90 : authorityForUrl(candidate.url);
  candidate.raw = paper;
  return candidate;
}

export async function searchSemanticScholar(query: string, limit = 5): Promise<ReferenceCandidate[]> {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized || process.env.SEMANTIC_SCHOLAR_ENABLED === "false") return [];

  const params = new URLSearchParams({ query: normalized, limit: String(limit), fields: FIELDS });
  const headers: Record<string, string> = { "User-Agent": "MoodleAIReviewer/0.3" };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      if (response.status !== 429) logger.warn(`Semantic Scholar search HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { data?: SemanticScholarPaper[] };
    return Array.isArray(data.data) ? data.data.map(toCandidate) : [];
  } catch (error) {
    logger.warn("Semantic Scholar search failed", error);
    return [];
  }
}
