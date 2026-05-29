import { logger } from "../shared/logger";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);

export interface UnpaywallHit {
  doi: string;
  isOpenAccess: boolean;
  pdfUrl: string | null;
  landingUrl: string | null;
  hostType: string | null;
  raw: unknown;
}

export async function lookupUnpaywall(doi: string): Promise<UnpaywallHit | null> {
  const email = process.env.REFERENCE_CONTACT_EMAIL;
  if (!email) {
    logger.error?.(
      "Unpaywall skipped: REFERENCE_CONTACT_EMAIL not configured",
      new Error("missing email"),
    );
    return null;
  }

  try {
    const response = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`,
      {
        headers: { "User-Agent": `MoodleAIReviewer/0.3 (mailto:${email})` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as any;
    const best = data?.best_oa_location ?? null;
    return {
      doi,
      isOpenAccess: Boolean(data?.is_oa),
      pdfUrl: best?.url_for_pdf ?? null,
      landingUrl: best?.url_for_landing_page ?? data?.doi_url ?? null,
      hostType: best?.host_type ?? null,
      raw: data,
    };
  } catch (error) {
    logger.error("Unpaywall lookup failed", error);
    return null;
  }
}
