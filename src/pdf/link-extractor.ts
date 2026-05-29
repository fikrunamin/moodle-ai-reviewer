import type { ExtractedLinkKind } from "../shared/types";

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'\)\]\}]+/gi;
const TRAILING_PUNCT = /[\.,;:!\?\)\]\}>]+$/;

export interface ExtractedLinkCandidate {
  url: string;
  kind: ExtractedLinkKind;
  fileId?: string | null;
}

function normalizeUrl(rawUrl: string): string | null {
  let url = rawUrl.trim();
  // Strip common trailing punctuation that gets glued to URLs in PDFs.
  while (TRAILING_PUNCT.test(url)) {
    url = url.replace(TRAILING_PUNCT, "");
  }
  // Balance trailing parentheses caused by "(see https://x.com/foo)" patterns.
  const opens = (url.match(/\(/g) ?? []).length;
  const closes = (url.match(/\)/g) ?? []).length;
  let trimmed = url;
  let extraCloses = closes - opens;
  while (extraCloses > 0 && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(0, -1);
    extraCloses -= 1;
  }
  url = trimmed;

  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return null;
  }
}

function classify(url: string): ExtractedLinkKind {
  const lower = url.toLowerCase();
  if (
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/shorts/") ||
    lower.includes("youtube.com/embed/") ||
    lower.includes("youtube-nocookie.com/embed/")
  ) {
    return "youtube";
  }
  if (lower.includes("arxiv.org/abs/") || lower.includes("arxiv.org/pdf/")) {
    return "arxiv";
  }
  if (lower.includes("doi.org/")) {
    return "doi";
  }
  return "generic";
}

export function extractLinksFromText(text: string): ExtractedLinkCandidate[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) ?? [];
  const results: ExtractedLinkCandidate[] = [];
  for (const match of matches) {
    const normalized = normalizeUrl(match);
    if (!normalized) continue;
    results.push({ url: normalized, kind: classify(normalized) });
  }
  return results;
}

export function extractLinksFromSources(sources: Array<{ text: string; fileId?: string | null }>) {
  const seen = new Map<string, ExtractedLinkCandidate>();
  for (const source of sources) {
    const found = extractLinksFromText(source.text);
    for (const candidate of found) {
      if (seen.has(candidate.url)) continue;
      seen.set(candidate.url, { ...candidate, fileId: source.fileId ?? null });
    }
  }
  return Array.from(seen.values());
}
