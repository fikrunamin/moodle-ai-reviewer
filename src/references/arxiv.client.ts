import { logger } from "../shared/logger";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);

export interface ArxivHit {
  arxivId: string;
  title?: string;
  authors: string[];
  year?: number | null;
  pdfUrl: string;
  landingUrl: string;
  raw: string;
}

function parseArxivAtom(xml: string): ArxivHit | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;
  const entry = entryMatch[1];

  const idMatch = entry.match(/<id>(.*?)<\/id>/);
  const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
  const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
  const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g) ?? [];

  if (!idMatch) return null;
  const arxivUrl = idMatch[1].trim();
  const arxivId =
    arxivUrl.match(/arxiv\.org\/abs\/([\w\.\-]+)/i)?.[1] ?? arxivUrl.split("/").pop() ?? "";
  if (!arxivId) return null;

  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : undefined;
  const year = publishedMatch ? Number(publishedMatch[1].slice(0, 4)) : null;
  const authors = authorMatches
    .map((block) => block.match(/<name>(.*?)<\/name>/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    arxivId,
    title,
    authors,
    year,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
    landingUrl: `https://arxiv.org/abs/${arxivId}`,
    raw: xml,
  };
}

async function fetchArxiv(query: string): Promise<ArxivHit | null> {
  try {
    const response = await fetch(`http://export.arxiv.org/api/query?${query}`, {
      headers: { "User-Agent": "MoodleAIReviewer/0.3" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const xml = await response.text();
    return parseArxivAtom(xml);
  } catch (error) {
    logger.error("arXiv fetch failed", error);
    return null;
  }
}

export function lookupArxivById(arxivId: string) {
  return fetchArxiv(`id_list=${encodeURIComponent(arxivId)}&max_results=1`);
}

export function lookupArxivByQuery(input: { title?: string | null; authors?: string[] | null }) {
  if (!input.title) return Promise.resolve(null);
  const titlePart = `ti:"${input.title.replace(/"/g, "")}"`;
  const authorPart =
    input.authors && input.authors.length
      ? ` AND au:"${input.authors[0]!.replace(/"/g, "")}"`
      : "";
  const search = encodeURIComponent(`${titlePart}${authorPart}`);
  return fetchArxiv(`search_query=${search}&max_results=1`);
}
