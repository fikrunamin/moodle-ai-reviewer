import type { ReferenceResolveSource } from "../shared/types";

/**
 * Normalized search candidate shape returned by every reference provider
 * (Semantic Scholar, OpenAlex, Tavily, Brave, SerpAPI, Google, Crossref, arXiv).
 */
export interface ReferenceCandidate {
  source: ReferenceResolveSource;
  title: string | null;
  url: string | null;
  pdfUrl: string | null;
  doi: string | null;
  arxivId: string | null;
  year: number | null;
  authors: string[];
  venue: string | null;
  abstract: string | null;
  snippet: string | null;
  citationCount: number | null;
  /** 0-100 authority tier estimate used for ranking. */
  authority: number;
  raw?: unknown;
}

export function emptyCandidate(source: ReferenceResolveSource): ReferenceCandidate {
  return {
    source,
    title: null,
    url: null,
    pdfUrl: null,
    doi: null,
    arxivId: null,
    year: null,
    authors: [],
    venue: null,
    abstract: null,
    snippet: null,
    citationCount: null,
    authority: 50,
  };
}

const HIGH_AUTHORITY_HOSTS = [
  ".gov",
  ".go.id",
  ".edu",
  ".ac.id",
  ".ac.uk",
  "doi.org",
  "arxiv.org",
  "ncbi.nlm.nih.gov",
  "springer.com",
  "sciencedirect.com",
  "ieee.org",
  "acm.org",
  "nature.com",
  "wiley.com",
  "tandfonline.com",
  "jstor.org",
];

const MEDIUM_AUTHORITY_HOSTS = [".org", "researchgate.net", "semanticscholar.org", "ssrn.com"];

const LOW_AUTHORITY_HOSTS = ["wikipedia.org", "medium.com", "blogspot.", "wordpress.", "youtube.com", "youtu.be"];

export function authorityForUrl(url: string | null): number {
  if (!url) return 50;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 40;
  }
  if (HIGH_AUTHORITY_HOSTS.some((part) => host.includes(part))) return 95;
  if (MEDIUM_AUTHORITY_HOSTS.some((part) => host.includes(part))) return 70;
  if (LOW_AUTHORITY_HOSTS.some((part) => host.includes(part))) return 35;
  return 55;
}

export function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
