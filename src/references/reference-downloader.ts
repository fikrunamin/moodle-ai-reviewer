import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { paths } from "../runtime/paths";
import { logger } from "../shared/logger";

const REQUEST_TIMEOUT_MS = Number(process.env.REFERENCE_REQUEST_TIMEOUT_MS ?? 20_000);
const MAX_BYTES = Math.max(1, Number(process.env.REFERENCE_MAX_MB ?? 30)) * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-");

export interface DownloadResult {
  ok: boolean;
  pdfPath: string | null;
  finalUrl: string | null;
  error?: string;
}

export async function downloadReferencePdf(url: string): Promise<DownloadResult> {
  if (!url) return { ok: false, pdfPath: null, finalUrl: null, error: "Missing URL" };

  const cacheKey = createHash("sha1").update(url).digest("hex");
  const targetPath = join(paths.references, `${cacheKey}.pdf`);
  const relativePath = relative(paths.root, targetPath);

  if (existsSync(targetPath)) {
    return { ok: true, pdfPath: relativePath, finalUrl: url };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": `MoodleAIReviewer/0.3 (+reference-resolver)`,
        Accept: "application/pdf,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        ok: false,
        pdfPath: null,
        finalUrl: response.url || url,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("pdf")) {
      // still try, some servers return octet-stream; we will check magic bytes.
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, pdfPath: null, finalUrl: response.url || url, error: "No body" };
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {}
        return {
          ok: false,
          pdfPath: null,
          finalUrl: response.url || url,
          error: `PDF exceeds ${MAX_BYTES} bytes`,
        };
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      return {
        ok: false,
        pdfPath: null,
        finalUrl: response.url || url,
        error: "Not a valid PDF",
      };
    }

    await writeFile(targetPath, buffer);
    return { ok: true, pdfPath: relativePath, finalUrl: response.url || url };
  } catch (error) {
    logger.error("Reference PDF download failed", error);
    return {
      ok: false,
      pdfPath: null,
      finalUrl: url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
