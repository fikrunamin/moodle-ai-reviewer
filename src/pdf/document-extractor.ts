import { basename, extname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { paths } from "../runtime/paths";
import { extractPdfText } from "./pdf-extractor";
import { extractDocxText } from "./docx-extractor";

export type DocumentKind = "pdf" | "docx" | "unknown";

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"

export async function detectDocumentKind(filePath: string): Promise<DocumentKind> {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";

  // Fall back to magic-byte sniffing for files without a clear extension.
  try {
    const handle = await readFile(filePath);
    if (handle.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return "pdf";
    if (handle.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) return "docx"; // best effort
  } catch {
    return "unknown";
  }
  return "unknown";
}

/**
 * Extract plain text from a supported document (PDF or DOCX) and persist a
 * .txt sidecar in data/extracted, mirroring extractPdfText behaviour.
 */
export async function extractDocumentText(
  filePath: string,
): Promise<{ text: string; outputPath: string; kind: DocumentKind }> {
  const kind = await detectDocumentKind(filePath);

  if (kind === "pdf") {
    const result = await extractPdfText(filePath);
    return { ...result, kind };
  }

  if (kind === "docx") {
    const text = await extractDocxText(filePath);
    const outputPath = join(paths.extracted, `${basename(filePath)}.txt`);
    await writeFile(outputPath, text, "utf8");
    return { text, outputPath, kind };
  }

  throw new Error(`Unsupported document type for ${basename(filePath)}`);
}
