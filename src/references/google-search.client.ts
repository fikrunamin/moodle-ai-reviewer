import { logger } from "../shared/logger";
import { launchBrowser } from "../browser/puppeteer-client";
import { authorityForUrl, emptyCandidate, type ReferenceCandidate } from "./reference-candidate";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const DOI_REGEX = /\b(10\.\d{4,9}\/[\w\-.;()/: %#]+)\b/i;

export interface GoogleReferenceSearchHit {
  searchUrl: string;
  doi: string | null;
  pdfUrls: string[];
  landingUrls: string[];
  blocked: boolean;
}

function makeHit(input: {
  searchUrl: string;
  htmlOrText: string;
  urls: string[];
  blocked?: boolean;
}): GoogleReferenceSearchHit {
  const pdfUrls = input.urls.filter((url) => /\.pdf(?:[?#]|$)/i.test(url) || /[?&]download=1/i.test(url));
  const landingUrls = input.urls.filter((url) => !pdfUrls.includes(url));
  const doi =
    input.htmlOrText.match(DOI_REGEX)?.[1]?.replace(/[.,;]+$/, "") ??
    input.urls.join("\n").match(DOI_REGEX)?.[1]?.replace(/[.,;]+$/, "") ??
    null;
  return {
    searchUrl: input.searchUrl,
    doi,
    pdfUrls: pdfUrls.slice(0, 5),
    landingUrls: landingUrls.slice(0, 8),
    blocked: Boolean(input.blocked),
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractGoogleTarget(rawHref: string) {
  const href = decodeHtml(rawHref);
  try {
    const parsed = new URL(href, "https://www.google.com");
    if (parsed.pathname === "/url" && parsed.searchParams.get("q")) {
      return parsed.searchParams.get("q");
    }
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return null;
  }
  return null;
}

function isGoogleInternal(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "google.com" || host.endsWith(".google.com") || host === "gstatic.com" || host.endsWith(".gstatic.com");
  } catch {
    return true;
  }
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function searchGoogleReference(query: string): Promise<GoogleReferenceSearchHit | null> {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized || process.env.REFERENCE_GOOGLE_SEARCH_ENABLED === "false") return null;

  const searchUrl = `https://www.google.com/search?${new URLSearchParams({
    q: normalized,
    num: String(Math.max(1, Number(process.env.REFERENCE_GOOGLE_RESULT_LIMIT ?? 8))),
    hl: "en",
  }).toString()}`;

  const browserHit = await searchGoogleReferenceWithBrowser(searchUrl).catch((error) => {
    logger.warn("Google browser reference search failed", error);
    return null;
  });
  if (browserHit && (browserHit.pdfUrls.length || browserHit.landingUrls.length || browserHit.doi) && !browserHit.blocked) {
    return browserHit;
  }

  const fetchHit = await searchGoogleReferenceWithFetch(searchUrl).catch((error) => {
    logger.warn("Google reference search failed", error);
    return null;
  });
  return fetchHit ?? browserHit;
}

async function searchGoogleReferenceWithFetch(searchUrl: string): Promise<GoogleReferenceSearchHit | null> {
  if (process.env.REFERENCE_GOOGLE_FETCH_FALLBACK_ENABLED === "false") return null;
  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MoodleAIReviewer/0.3; +reference-resolver)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const blocked = /unusual traffic|sorry\/index|detected unusual|enablejs/i.test(html);

    const hrefs = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)).map((match) => match[1]);
    const urls = unique(hrefs.map(extractGoogleTarget)).filter((url) => !isGoogleInternal(url));
    const hit = makeHit({ searchUrl, htmlOrText: html, urls, blocked });
    return hit;
  } catch (error) {
    logger.warn("Google fetch reference search failed", error);
    return null;
  }
}

async function searchGoogleReferenceWithBrowser(searchUrl: string): Promise<GoogleReferenceSearchHit | null> {
  if (process.env.REFERENCE_GOOGLE_BROWSER_SEARCH_ENABLED === "false") return null;
  const browser = await launchBrowser({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: Number(process.env.REFERENCE_GOOGLE_SEARCH_TIMEOUT_MS ?? 18_000),
    });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const data = await page.evaluate(() => {
      const hrefs = Array.from(document.querySelectorAll("a[href]")).map((anchor) => (anchor as HTMLAnchorElement).href);
      const text = document.body?.innerText ?? "";
      return { hrefs, text };
    });
    const urls = unique(data.hrefs.map(extractGoogleTarget)).filter((url) => !isGoogleInternal(url));
    const blocked = /unusual traffic|detected unusual|captcha|sorry/i.test(data.text);
    return makeHit({ searchUrl, htmlOrText: data.text, urls, blocked });
  } finally {
    await browser.close().catch(() => null);
  }
}

function hitToCandidates(hit: GoogleReferenceSearchHit): ReferenceCandidate[] {
  const candidates: ReferenceCandidate[] = [];
  for (const pdfUrl of hit.pdfUrls) {
    const candidate = emptyCandidate("google");
    candidate.url = pdfUrl;
    candidate.pdfUrl = pdfUrl;
    candidate.doi = hit.doi;
    candidate.authority = authorityForUrl(pdfUrl);
    candidates.push(candidate);
  }
  for (const landingUrl of hit.landingUrls) {
    const candidate = emptyCandidate("google");
    candidate.url = landingUrl;
    candidate.doi = hit.doi;
    candidate.authority = authorityForUrl(landingUrl);
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Run a set of Google queries (typically the planner's pdf_queries) and return
 * normalized candidates. Best effort: Google often blocks automation, in which
 * case this returns whatever was found before the block.
 */
export async function searchGoogleQueries(queries: string[]): Promise<ReferenceCandidate[]> {
  if (process.env.REFERENCE_GOOGLE_SEARCH_ENABLED === "false") return [];
  const limit = Math.max(1, Number(process.env.REFERENCE_GOOGLE_QUERY_LIMIT ?? 3));
  const selected = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(0, limit);

  const seen = new Set<string>();
  const candidates: ReferenceCandidate[] = [];
  for (const query of selected) {
    const hit = await searchGoogleReference(query).catch((error) => {
      logger.warn("Google query search failed", error);
      return null;
    });
    if (!hit) continue;
    for (const candidate of hitToCandidates(hit)) {
      if (!candidate.url || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      candidates.push(candidate);
    }
  }
  return candidates;
}
