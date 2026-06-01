import { AiProviderService } from "./ai-provider.service";
import { buildCitationValidationPrompt } from "./prompt-builder";
import type {
  ReferenceClaimSupport,
  ReferenceType,
  ReferenceValidationStatus,
} from "../shared/types";

export interface CitationValidationReferenceInput {
  rawText: string;
  authors?: string[] | null;
  year?: number | null;
  title?: string | null;
  source?: string | null;
  doi?: string | null;
  url?: string | null;
  arxivId?: string | null;
}

export interface CitationValidationInput {
  mode: "assignment" | "forum";
  courseContext?: string | null;
  instruction?: string | null;
  forumPrompt?: string | null;
  studentText: string;
  reference: CitationValidationReferenceInput;
  resolvedMetadata?: string | null;
}

export interface CitationValidationResult {
  validation_status: ReferenceValidationStatus;
  claim_support: ReferenceClaimSupport;
  metadata_match_score: number;
  source_quality_score: number;
  reference_type: ReferenceType;
  matched_url: string | null;
  matched_doi: string | null;
  matched_title: string | null;
  evidence: string[];
  issues: string[];
  analysis: string;
}

const validationStatuses = new Set<ReferenceValidationStatus>([
  "valid",
  "likely_valid",
  "unverified",
  "invalid",
]);
const claimSupports = new Set<ReferenceClaimSupport>([
  "supports",
  "partially_supports",
  "does_not_support",
  "not_assessed",
]);
const referenceTypes = new Set<ReferenceType>([
  "journal_article",
  "conference_paper",
  "book",
  "chapter",
  "webpage",
  "pdf_document",
  "preprint",
  "report",
  "video",
  "unknown",
]);

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter((item): item is string => Boolean(item)).slice(0, 12);
}

function score(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const cleaned = cleanString(value);
  return cleaned && allowed.has(cleaned as T) ? (cleaned as T) : fallback;
}

function sanitizeResult(raw: unknown): CitationValidationResult {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    validation_status: enumValue(value.validation_status, validationStatuses, "unverified"),
    claim_support: enumValue(value.claim_support, claimSupports, "not_assessed"),
    metadata_match_score: score(value.metadata_match_score),
    source_quality_score: score(value.source_quality_score),
    reference_type: enumValue(value.reference_type, referenceTypes, "unknown"),
    matched_url: cleanString(value.matched_url),
    matched_doi: cleanString(value.matched_doi),
    matched_title: cleanString(value.matched_title),
    evidence: stringList(value.evidence),
    issues: stringList(value.issues),
    analysis: cleanString(value.analysis) ?? "Validasi referensi tidak memberikan analisis rinci.",
  };
}

export class CitationValidationAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async validate(input: CitationValidationInput): Promise<CitationValidationResult> {
    const result = await this.provider.getClient().completeJson(buildCitationValidationPrompt(input), {
      timeoutMs: Number(process.env.CITATION_VALIDATION_TIMEOUT_MS ?? 120_000),
    });
    return sanitizeResult(result);
  }
}
