import { lookupArxivById, lookupArxivByQuery } from "./arxiv.client";
import { lookupCrossrefByDoi, lookupCrossrefByQuery } from "./crossref.client";
import { searchGoogleReference } from "./google-search.client";
import { lookupUnpaywall } from "./unpaywall.client";
import { downloadReferencePdf } from "./reference-downloader";
import { ReferenceResolutionCache } from "../database/repositories/reference.repository";
import type { ExtractedReference, ReferenceResolveSource } from "../shared/types";

export interface ResolveOutcome {
  source: ReferenceResolveSource;
  pdfPath: string | null;
  pdfUrl: string | null;
  metadata: unknown;
  error?: string | null;
}

function buildCacheKey(reference: ExtractedReference): string {
  if (reference.doi) return `doi:${reference.doi.toLowerCase()}`;
  if (reference.arxiv_id) return `arxiv:${reference.arxiv_id.toLowerCase()}`;
  const titleSlug =
    (reference.title ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled";
  const authorPart = (() => {
    if (!reference.authors) return "anon";
    try {
      const list = JSON.parse(reference.authors);
      const first = Array.isArray(list) && list.length ? String(list[0]) : "anon";
      return first
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .pop() ?? "anon";
    } catch {
      return "anon";
    }
  })();
  return `norm:${titleSlug}|${authorPart}|${reference.year ?? "0"}`;
}

function metadataAsBundle(reference: ExtractedReference) {
  let authorsParsed: string[] | null = null;
  if (reference.authors) {
    try {
      const value = JSON.parse(reference.authors);
      if (Array.isArray(value)) authorsParsed = value.map((item) => String(item));
    } catch {
      authorsParsed = null;
    }
  }
  return {
    rawText: reference.raw_text,
    title: reference.title,
    authors: authorsParsed,
    year: reference.year,
    source: reference.source,
    doi: reference.doi,
    arxivId: reference.arxiv_id,
    url: reference.url,
  };
}

function buildScholarSearchUrl(reference: ExtractedReference) {
  const query = [reference.title, reference.year, ...(metadataAsBundle(reference).authors ?? [])]
    .filter(Boolean)
    .join(" ");
  if (!query.trim()) return null;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
}

function buildGoogleQuery(reference: ExtractedReference) {
  const bundle = metadataAsBundle(reference);
  const structured = [bundle.title, bundle.year, ...(bundle.authors ?? []), bundle.source]
    .filter(Boolean)
    .join(" ");
  return structured.trim() || reference.raw_text;
}

export async function resolveReference(reference: ExtractedReference): Promise<ResolveOutcome> {
  const cache = new ReferenceResolutionCache();
  const cacheKey = buildCacheKey(reference);
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      source: "cache",
      pdfPath: cached.pdf_path,
      pdfUrl: cached.pdf_url,
      metadata: safeParseJson(cached.metadata_json) ?? metadataAsBundle(reference),
    };
  }

  const bundle = metadataAsBundle(reference);

  // Step 1: Google web search (best effort) to discover DOI/PDF/landing pages.
  const google = await searchGoogleReference(buildGoogleQuery(reference));

  // Step 2: Crossref
  const googleDoi = google?.doi ?? null;
  let crossref = reference.doi || googleDoi ? await lookupCrossrefByDoi(reference.doi ?? googleDoi!) : null;
  if (!crossref) crossref = await lookupCrossrefByQuery({
    title: bundle.title,
    authors: bundle.authors,
    year: bundle.year,
  });

  const doi = crossref?.doi ?? reference.doi ?? googleDoi ?? null;

  // Step 3: Unpaywall (only if we have a DOI)
  let unpaywall = doi ? await lookupUnpaywall(doi) : null;

  // Step 4: arXiv
  let arxiv = reference.arxiv_id ? await lookupArxivById(reference.arxiv_id) : null;
  if (!arxiv && !unpaywall?.pdfUrl) {
    arxiv = await lookupArxivByQuery({ title: bundle.title, authors: bundle.authors });
  }

  // Try downloads in order: Google direct PDF → Unpaywall → Crossref direct PDF → arXiv
  const candidates: Array<{ source: ReferenceResolveSource; url: string }> = [];
  for (const url of google?.pdfUrls ?? []) candidates.push({ source: "google", url });
  if (unpaywall?.pdfUrl) candidates.push({ source: "unpaywall", url: unpaywall.pdfUrl });
  if (crossref?.pdfUrl) candidates.push({ source: "crossref", url: crossref.pdfUrl });
  if (arxiv?.pdfUrl) candidates.push({ source: "arxiv", url: arxiv.pdfUrl });

  let lastError: string | null = null;
  for (const candidate of candidates) {
    const download = await downloadReferencePdf(candidate.url);
    if (download.ok && download.pdfPath) {
      const metadata = {
        google,
        crossref,
        unpaywall,
        arxiv,
        scholarUrl: buildScholarSearchUrl(reference),
        downloadedFrom: candidate.url,
        landingUrl:
          google?.landingUrls[0] ??
          google?.searchUrl ??
          unpaywall?.landingUrl ??
          crossref?.landingUrl ??
          arxiv?.landingUrl ??
          null,
      };
      cache.set({
        cacheKey,
        source: candidate.source,
        pdfPath: download.pdfPath,
        pdfUrl: download.finalUrl,
        metadata,
      });
      return {
        source: candidate.source,
        pdfPath: download.pdfPath,
        pdfUrl: download.finalUrl,
        metadata,
      };
    }
    lastError = download.error ?? null;
  }

  // No PDF found, but we may have metadata
  const fallbackMetadata = {
    google,
    crossref,
    unpaywall,
    arxiv,
    scholarUrl: buildScholarSearchUrl(reference),
    landingUrl:
      google?.landingUrls[0] ?? google?.searchUrl ?? unpaywall?.landingUrl ?? crossref?.landingUrl ?? arxiv?.landingUrl ?? reference.url ?? null,
    lastError,
  };
  cache.set({
    cacheKey,
    source: "none",
    pdfPath: null,
    pdfUrl: fallbackMetadata.landingUrl,
    metadata: fallbackMetadata,
  });
  return {
    source: "none",
    pdfPath: null,
    pdfUrl: fallbackMetadata.landingUrl,
    metadata: fallbackMetadata,
    error: lastError,
  };
}

function safeParseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
