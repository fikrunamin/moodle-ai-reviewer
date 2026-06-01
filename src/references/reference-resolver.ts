import { lookupArxivById, lookupArxivByQuery } from "./arxiv.client";
import { lookupCrossrefByDoi, lookupCrossrefByQuery } from "./crossref.client";
import { searchGoogleQueries } from "./google-search.client";
import { searchSemanticScholar } from "./semantic-scholar.client";
import { searchOpenAlex } from "./openalex.client";
import { searchTavily } from "./tavily.client";
import { searchBrave } from "./brave.client";
import { searchSerpApi } from "./serpapi.client";
import { lookupUnpaywall } from "./unpaywall.client";
import { downloadReferencePdf } from "./reference-downloader";
import { ReferenceResolutionCache } from "../database/repositories/reference.repository";
import {
  ReferenceSearchPlannerAgent,
  type ReferenceSearchPlan,
} from "../ai/reference-search-planner.agent";
import {
  emptyCandidate,
  normalizeTitle,
  type ReferenceCandidate,
} from "./reference-candidate";
import type { ExtractedReference, ReferenceResolveSource } from "../shared/types";

export interface ResolveOutcome {
  source: ReferenceResolveSource;
  pdfPath: string | null;
  pdfUrl: string | null;
  metadata: unknown;
  error?: string | null;
}

const DEFAULT_PROVIDER_ORDER: ReferenceResolveSource[] = [
  "semantic_scholar",
  "openalex",
  "arxiv",
  "tavily",
  "brave",
  "serpapi",
  "google",
];

function referenceLog(message: string, details: Record<string, unknown> = {}) {
  console.log(`[reference-search] ${message}`, details);
}

function providerEnvStatus() {
  return {
    tavily: Boolean(process.env.TAVILY_API_KEY),
    brave: Boolean(process.env.BRAVE_SEARCH_API_KEY),
    serpapi: Boolean(process.env.SERPAPI_API_KEY),
    semanticScholar: Boolean(process.env.SEMANTIC_SCHOLAR_API_KEY),
  };
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

function parsedAuthors(reference: ExtractedReference): string[] | null {
  if (!reference.authors) return null;
  try {
    const value = JSON.parse(reference.authors);
    return Array.isArray(value) ? value.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function metadataAsBundle(reference: ExtractedReference) {
  return {
    rawText: reference.raw_text,
    title: reference.title,
    authors: parsedAuthors(reference),
    year: reference.year,
    source: reference.source,
    doi: reference.doi,
    arxivId: reference.arxiv_id,
    url: reference.url,
  };
}

function buildScholarSearchUrl(reference: ExtractedReference) {
  const query = [reference.title, reference.year, ...(parsedAuthors(reference) ?? [])]
    .filter(Boolean)
    .join(" ");
  if (!query.trim()) return null;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
}

function providerOrder(plan: ReferenceSearchPlan): ReferenceResolveSource[] {
  const override = process.env.REFERENCE_SEARCH_PROVIDER_ORDER;
  let order = override
    ? (override.split(",").map((item) => item.trim()).filter(Boolean) as ReferenceResolveSource[])
    : [...DEFAULT_PROVIDER_ORDER];
  if (!plan.is_academic) {
    // Prioritize web search providers for non-academic citations.
    order = order.sort((a, b) => {
      const academic = new Set<ReferenceResolveSource>(["semantic_scholar", "openalex", "arxiv"]);
      return Number(academic.has(a)) - Number(academic.has(b));
    });
  }
  return order;
}

function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;
  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function dedupeCandidates(candidates: ReferenceCandidate[]): ReferenceCandidate[] {
  const byKey = new Map<string, ReferenceCandidate>();
  for (const candidate of candidates) {
    const key =
      (candidate.doi && `doi:${candidate.doi.toLowerCase()}`) ||
      (candidate.arxivId && `arxiv:${candidate.arxivId.toLowerCase()}`) ||
      (candidate.url && `url:${candidate.url.toLowerCase()}`) ||
      (candidate.title && `title:${normalizeTitle(candidate.title)}`) ||
      `raw:${Math.random()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    // Merge: prefer the candidate that has a PDF / richer metadata.
    const merged: ReferenceCandidate = { ...existing };
    merged.pdfUrl = existing.pdfUrl ?? candidate.pdfUrl;
    merged.doi = existing.doi ?? candidate.doi;
    merged.arxivId = existing.arxivId ?? candidate.arxivId;
    merged.abstract = existing.abstract ?? candidate.abstract;
    merged.snippet = existing.snippet ?? candidate.snippet;
    merged.year = existing.year ?? candidate.year;
    merged.venue = existing.venue ?? candidate.venue;
    merged.citationCount = existing.citationCount ?? candidate.citationCount;
    merged.authority = Math.max(existing.authority, candidate.authority);
    byKey.set(key, merged);
  }
  return Array.from(byKey.values());
}

function rankCandidates(candidates: ReferenceCandidate[], reference: ExtractedReference): ReferenceCandidate[] {
  const referenceTitle = reference.title ?? reference.raw_text ?? "";
  const currentYear = new Date().getFullYear();
  return candidates
    .map((candidate) => {
      const relevance = candidate.title ? titleSimilarity(referenceTitle, candidate.title) : 0.3;
      const freshness = candidate.year ? Math.max(0, 1 - (currentYear - candidate.year) / 30) : 0.4;
      const hasPdf = candidate.pdfUrl ? 1 : 0;
      const score =
        relevance * 45 + (candidate.authority / 100) * 35 + freshness * 10 + hasPdf * 10;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate);
}

async function collectFromProvider(
  source: ReferenceResolveSource,
  plan: ReferenceSearchPlan,
): Promise<ReferenceCandidate[]> {
  const primaryQuery = plan.queries[0] ?? plan.title_guess ?? "";
  switch (source) {
    case "semantic_scholar":
      return primaryQuery ? searchSemanticScholar(primaryQuery) : [];
    case "openalex":
      return primaryQuery ? searchOpenAlex(primaryQuery) : [];
    case "arxiv": {
      if (!plan.is_academic) return [];
      const hit = plan.expected_arxiv_id
        ? await lookupArxivById(plan.expected_arxiv_id)
        : plan.title_guess
          ? await lookupArxivByQuery({ title: plan.title_guess, authors: null })
          : null;
      if (!hit) return [];
      const candidate = emptyCandidate("arxiv");
      candidate.title = hit.title ?? null;
      candidate.authors = hit.authors;
      candidate.year = hit.year ?? null;
      candidate.arxivId = hit.arxivId;
      candidate.pdfUrl = hit.pdfUrl;
      candidate.url = hit.landingUrl;
      candidate.authority = 90;
      return [candidate];
    }
    case "tavily":
      return primaryQuery ? searchTavily(primaryQuery) : [];
    case "brave":
      return primaryQuery ? searchBrave(primaryQuery) : [];
    case "serpapi":
      return primaryQuery ? searchSerpApi(primaryQuery) : [];
    case "google":
      return searchGoogleQueries([...plan.pdf_queries, ...plan.queries]);
    default:
      return [];
  }
}

export async function resolveReference(reference: ExtractedReference): Promise<ResolveOutcome> {
  const cache = new ReferenceResolutionCache();
  const cacheKey = buildCacheKey(reference);
  referenceLog("start", {
    referenceId: reference.id,
    cacheKey,
    title: reference.title,
    doi: reference.doi,
    arxivId: reference.arxiv_id,
  });
  const cached = cache.get(cacheKey);
  if (cached) {
    referenceLog("cache hit", {
      referenceId: reference.id,
      source: cached.source,
      hasPdf: Boolean(cached.pdf_path),
      pdfUrl: cached.pdf_url,
    });
    return {
      source: "cache",
      pdfPath: cached.pdf_path,
      pdfUrl: cached.pdf_url,
      metadata: safeParseJson(cached.metadata_json) ?? metadataAsBundle(reference),
    };
  }

  const bundle = metadataAsBundle(reference);

  // Step 1: AI planner produces queries + classifies academic vs general.
  const plan = await new ReferenceSearchPlannerAgent().plan({
    rawText: reference.raw_text,
    title: reference.title,
    authors: bundle.authors,
    year: reference.year,
    doi: reference.doi,
    url: reference.url,
    arxivId: reference.arxiv_id,
  });
  referenceLog("planner result", {
    referenceId: reference.id,
    intent: plan.intent,
    isAcademic: plan.is_academic,
    queries: plan.queries,
    pdfQueries: plan.pdf_queries,
  });

  // Step 2: collect candidates from configured providers (skips those without keys).
  const maxCandidates = Math.max(3, Number(process.env.REFERENCE_SEARCH_MAX_CANDIDATES ?? 8));
  const collected: ReferenceCandidate[] = [];
  const order = providerOrder(plan);
  referenceLog("provider order", { referenceId: reference.id, order, configured: providerEnvStatus() });
  for (const source of order) {
    try {
      referenceLog("provider search start", { referenceId: reference.id, source });
      const found = await collectFromProvider(source, plan);
      collected.push(...found);
      referenceLog("provider search done", {
        referenceId: reference.id,
        source,
        found: found.length,
        collected: collected.length,
      });
    } catch (error) {
      // provider already logs internally; continue with others.
      referenceLog("provider search failed", {
        referenceId: reference.id,
        source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (collected.length >= maxCandidates * 2) {
      referenceLog("provider search stop", {
        referenceId: reference.id,
        reason: "candidate_limit_reached",
        collected: collected.length,
        limit: maxCandidates * 2,
        remainingProviders: order.slice(order.indexOf(source) + 1),
      });
      break;
    }
  }

  // Step 3: validate / enrich via Crossref + Unpaywall using best DOI we have.
  const ranked = rankCandidates(dedupeCandidates(collected), reference);
  referenceLog("candidates ranked", {
    referenceId: reference.id,
    collected: collected.length,
    ranked: ranked.length,
    top: ranked.slice(0, 3).map((candidate) => ({
      source: candidate.source,
      title: candidate.title,
      doi: candidate.doi,
      pdfUrl: candidate.pdfUrl,
      authority: candidate.authority,
    })),
  });
  const bestDoi =
    reference.doi ?? plan.expected_doi ?? ranked.find((candidate) => candidate.doi)?.doi ?? null;

  let crossref = bestDoi ? await lookupCrossrefByDoi(bestDoi) : null;
  if (!crossref && (bundle.title || plan.title_guess)) {
    crossref = await lookupCrossrefByQuery({
      title: bundle.title ?? plan.title_guess,
      authors: bundle.authors,
      year: bundle.year,
    });
  }
  const doi = crossref?.doi ?? bestDoi;
  const unpaywall = doi ? await lookupUnpaywall(doi) : null;
  referenceLog("metadata enrichment done", {
    referenceId: reference.id,
    bestDoi,
    crossrefDoi: crossref?.doi ?? null,
    unpaywallPdfUrl: unpaywall?.pdfUrl ?? null,
  });

  // Step 4: build ordered PDF download candidates.
  const downloadCandidates: Array<{ source: ReferenceResolveSource; url: string }> = [];
  for (const candidate of ranked) {
    if (candidate.pdfUrl) downloadCandidates.push({ source: candidate.source, url: candidate.pdfUrl });
  }
  if (unpaywall?.pdfUrl) downloadCandidates.push({ source: "unpaywall", url: unpaywall.pdfUrl });
  if (crossref?.pdfUrl) downloadCandidates.push({ source: "crossref", url: crossref.pdfUrl });

  const searchPlan = {
    intent: plan.intent,
    is_academic: plan.is_academic,
    language: plan.language,
    queries: plan.queries,
    pdf_queries: plan.pdf_queries,
  };
  const candidateSummary = ranked.slice(0, maxCandidates).map((candidate) => ({
    source: candidate.source,
    title: candidate.title,
    url: candidate.url,
    pdfUrl: candidate.pdfUrl,
    doi: candidate.doi,
    year: candidate.year,
    venue: candidate.venue,
    citationCount: candidate.citationCount,
    authority: candidate.authority,
    abstract: candidate.abstract,
    snippet: candidate.snippet,
  }));

  let lastError: string | null = null;
  const seenUrls = new Set<string>();
  for (const candidate of downloadCandidates) {
    if (!candidate.url || seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);
    referenceLog("pdf download start", {
      referenceId: reference.id,
      source: candidate.source,
      url: candidate.url,
    });
    const download = await downloadReferencePdf(candidate.url);
    if (download.ok && download.pdfPath) {
      referenceLog("pdf download success", {
        referenceId: reference.id,
        source: candidate.source,
        finalUrl: download.finalUrl,
        pdfPath: download.pdfPath,
      });
      const metadata = {
        searchPlan,
        candidates: candidateSummary,
        crossref,
        unpaywall,
        downloadedFrom: candidate.url,
        scholarUrl: buildScholarSearchUrl(reference),
        landingUrl:
          ranked.find((item) => item.url)?.url ??
          unpaywall?.landingUrl ??
          crossref?.landingUrl ??
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
    referenceLog("pdf download failed", {
      referenceId: reference.id,
      source: candidate.source,
      url: candidate.url,
      error: lastError,
    });
  }

  // No PDF found, but metadata/candidates may still help the tutor.
  const fallbackMetadata = {
    searchPlan,
    candidates: candidateSummary,
    crossref,
    unpaywall,
    scholarUrl: buildScholarSearchUrl(reference),
    landingUrl:
      ranked.find((item) => item.url)?.url ??
      unpaywall?.landingUrl ??
      crossref?.landingUrl ??
      reference.url ??
      null,
    lastError,
  };
  cache.set({
    cacheKey,
    source: "none",
    pdfPath: null,
    pdfUrl: fallbackMetadata.landingUrl,
    metadata: fallbackMetadata,
  });
  referenceLog("not found", {
    referenceId: reference.id,
    landingUrl: fallbackMetadata.landingUrl,
    lastError,
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
