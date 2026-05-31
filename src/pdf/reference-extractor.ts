import { ReferenceParserAgent } from "../ai/reference-parser.agent";
import type { ParsedReferenceInput } from "../database/repositories/reference.repository";
import { logger } from "../shared/logger";

const SECTION_HEADERS = [
  "daftar pustaka",
  "references",
  "bibliografi",
  "bibliography",
  "works cited",
  "literatur",
];
const NEXT_SECTION_HEADERS = [
  "lampiran",
  "appendix",
  "appendices",
  "ucapan terima kasih",
  "acknowledgments",
  "acknowledgements",
];

const DOI_REGEX = /\b(10\.\d{4,9}\/[\w\-\.\;\(\)\/:%#]+)\b/i;
const ARXIV_REGEX = /\barxiv:\s*(\d{4}\.\d{4,5})\b/i;
const ARXIV_URL_REGEX = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i;
const URL_REGEX = /\bhttps?:\/\/[^\s)]+/i;
const YEAR_REGEX = /\b(19|20)\d{2}\b/;

function findReferenceBlock(text: string): { block: string; truncated: boolean } {
  const lower = text.toLowerCase();
  let start = -1;
  for (const header of SECTION_HEADERS) {
    const candidate = lower.lastIndexOf(`\n${header}`);
    if (candidate > start) start = candidate + 1;
  }
  if (start < 0) {
    for (const header of SECTION_HEADERS) {
      const candidate = lower.indexOf(header);
      if (candidate >= 0) {
        start = candidate;
        break;
      }
    }
  }

  if (start < 0) {
    return { block: text, truncated: false };
  }

  let end = text.length;
  const tail = lower.slice(start + 10);
  for (const header of NEXT_SECTION_HEADERS) {
    const idx = tail.indexOf(`\n${header}`);
    if (idx >= 0) {
      const absolute = start + 10 + idx;
      if (absolute < end) end = absolute;
    }
  }
  return { block: text.slice(start, end), truncated: false };
}

function ensureDoiAndArxiv(reference: ParsedReferenceInput): ParsedReferenceInput {
  const updated: ParsedReferenceInput = { ...reference };
  if (!updated.doi) {
    const match = reference.rawText.match(DOI_REGEX);
    if (match) updated.doi = match[1];
  }
  if (!updated.arxivId) {
    const match = reference.rawText.match(ARXIV_REGEX) ?? reference.rawText.match(ARXIV_URL_REGEX);
    if (match) updated.arxivId = match[1];
  }
  return updated;
}

function dedupeReferences(refs: ParsedReferenceInput[]): ParsedReferenceInput[] {
  const seen = new Set<string>();
  const result: ParsedReferenceInput[] = [];
  for (const ref of refs) {
    const key = (ref.doi ?? ref.arxivId ?? ref.rawText).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

function parseReferencesHeuristic(block: string): ParsedReferenceInput[] {
  return block
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length >= 20)
    .filter((line) => DOI_REGEX.test(line) || ARXIV_REGEX.test(line) || ARXIV_URL_REGEX.test(line) || URL_REGEX.test(line) || YEAR_REGEX.test(line))
    .map((line) => {
      const doi = line.match(DOI_REGEX)?.[1] ?? null;
      const arxivId = line.match(ARXIV_REGEX)?.[1] ?? line.match(ARXIV_URL_REGEX)?.[1] ?? null;
      const url = line.match(URL_REGEX)?.[0]?.replace(/[.,;]+$/, "") ?? null;
      const year = Number(line.match(YEAR_REGEX)?.[0] ?? 0) || null;
      return ensureDoiAndArxiv({
        rawText: line,
        authors: null,
        year,
        title: null,
        source: null,
        doi,
        url,
        arxivId,
      });
    });
}

export interface ParsedReferences {
  references: ParsedReferenceInput[];
  block: string;
}

export async function parseReferencesFromText(text: string): Promise<ParsedReferences> {
  if (!text || !text.trim()) return { references: [], block: "" };

  const { block } = findReferenceBlock(text);
  if (!block.trim()) return { references: [], block: "" };

  let aiResult: { references?: Array<Record<string, unknown>> } | null = null;
  try {
    aiResult = (await new ReferenceParserAgent().parse({ rawText: block })) as {
      references?: Array<Record<string, unknown>>;
    };
  } catch (error) {
    logger.error("Reference parser AI failed", error);
    aiResult = null;
  }

  const fromAi: ParsedReferenceInput[] = Array.isArray(aiResult?.references)
    ? aiResult!.references!.map((entry) => {
        const authorsValue = entry.authors;
        const authors = Array.isArray(authorsValue)
          ? authorsValue.map((item) => String(item)).filter(Boolean)
          : null;
        const yearValue = entry.year;
        const year =
          typeof yearValue === "number"
            ? Math.trunc(yearValue)
            : typeof yearValue === "string" && /^\d{4}$/.test(yearValue.trim())
              ? Number(yearValue.trim())
              : null;
        return {
          rawText: String(entry.raw_text ?? "").trim() || JSON.stringify(entry),
          authors,
          year,
          title: entry.title ? String(entry.title).trim() : null,
          source: entry.source ? String(entry.source).trim() : null,
          doi: entry.doi ? String(entry.doi).trim() : null,
          url: entry.url ? String(entry.url).trim() : null,
          arxivId: entry.arxiv_id ? String(entry.arxiv_id).trim() : null,
        };
      })
    : [];

  const enriched = fromAi.map(ensureDoiAndArxiv);
  const fallback = enriched.length ? [] : parseReferencesHeuristic(block);
  return { references: dedupeReferences([...enriched, ...fallback]), block };
}
