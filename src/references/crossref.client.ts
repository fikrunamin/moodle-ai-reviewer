import { logger } from "../shared/logger";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);

function userAgent() {
  const email = process.env.REFERENCE_CONTACT_EMAIL ?? "anonymous@example.com";
  return `MoodleAIReviewer/0.3 (mailto:${email})`;
}

export interface CrossrefHit {
  doi: string;
  title?: string;
  authors: string[];
  year?: number | null;
  containerTitle?: string;
  pdfUrl?: string | null;
  landingUrl?: string | null;
  raw: unknown;
}

function parseCrossrefMessage(message: any): CrossrefHit | null {
  if (!message) return null;
  const doi = typeof message.DOI === "string" ? message.DOI : null;
  if (!doi) return null;
  const titles = Array.isArray(message.title) ? message.title : [];
  const authors = Array.isArray(message.author)
    ? message.author
        .map((author: any) => {
          const given = author?.given ? String(author.given) : "";
          const family = author?.family ? String(author.family) : "";
          return [given, family].filter(Boolean).join(" ");
        })
        .filter(Boolean)
    : [];
  const issued = message.issued?.["date-parts"]?.[0]?.[0];
  const year = typeof issued === "number" ? issued : Number(issued) || null;
  const containerTitles = Array.isArray(message["container-title"])
    ? message["container-title"]
    : [];
  const pdfLink = Array.isArray(message.link)
    ? message.link.find(
        (link: any) =>
          link?.URL &&
          (link["content-type"] === "application/pdf" ||
            (typeof link.URL === "string" && link.URL.toLowerCase().endsWith(".pdf"))),
      )
    : null;
  return {
    doi,
    title: titles[0],
    authors,
    year,
    containerTitle: containerTitles[0],
    pdfUrl: pdfLink?.URL ?? null,
    landingUrl: typeof message.URL === "string" ? message.URL : null,
    raw: message,
  };
}

export async function lookupCrossrefByDoi(doi: string): Promise<CrossrefHit | null> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: { "User-Agent": userAgent() },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: any };
    return parseCrossrefMessage(data.message ?? null);
  } catch (error) {
    logger.error("Crossref by DOI failed", error);
    return null;
  }
}

export async function lookupCrossrefByQuery(input: {
  title?: string | null;
  authors?: string[] | null;
  year?: number | null;
}): Promise<CrossrefHit | null> {
  if (!input.title) return null;
  const params = new URLSearchParams();
  params.set("query.bibliographic", input.title);
  if (input.authors && input.authors.length) {
    params.set("query.author", input.authors.slice(0, 3).join(" "));
  }
  params.set("rows", "1");

  try {
    const response = await fetch(`https://api.crossref.org/works?${params.toString()}`, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: { items?: any[] } };
    const item = data.message?.items?.[0];
    return parseCrossrefMessage(item ?? null);
  } catch (error) {
    logger.error("Crossref by query failed", error);
    return null;
  }
}
