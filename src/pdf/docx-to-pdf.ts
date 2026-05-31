import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { basename, join } from "node:path";
import { launchBrowser } from "../browser/puppeteer-client";
import { paths } from "../runtime/paths";
import { logger } from "../shared/logger";

/**
 * Convert a DOCX to a previewable PDF using the bundled Chrome (Puppeteer),
 * so no extra system dependency (LibreOffice etc.) is required.
 *
 * Fidelity is "readable", not pixel-perfect: we turn the document body XML
 * into clean HTML (paragraphs, line breaks, tables) and let Chrome paginate
 * it into a PDF.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 64 * 1024 - 22);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error("Not a valid ZIP/DOCX (EOCD not found)");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntryData(buffer: Buffer, entry: ZipEntry): Buffer {
  const base = entry.localHeaderOffset;
  if (buffer.readUInt32LE(base) !== LOCAL_SIGNATURE) {
    throw new Error("Invalid local file header in DOCX");
  }
  const nameLength = buffer.readUInt16LE(base + 26);
  const extraLength = buffer.readUInt16LE(base + 28);
  const dataStart = base + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return Buffer.from(data);
  if (entry.compressionMethod === 8) return inflateRawSync(data);
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod}`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Extract visible text of a single <w:p> paragraph, honoring runs/tabs/breaks. */
function paragraphToHtml(paragraphXml: string): string {
  // Collect text inside <w:t> ... </w:t>, plus line breaks/tabs.
  let out = "";
  const tokenRegex = /<w:(t|br|tab)(\s[^>]*)?>([\s\S]*?)<\/w:\1>|<w:(br|tab)\s*\/>/g;
  let match: RegExpExecArray | null;
  let matched = false;
  while ((match = tokenRegex.exec(paragraphXml))) {
    matched = true;
    const tag = match[1] ?? match[4];
    if (tag === "t") {
      out += escapeHtml(decodeXmlEntities(match[3] ?? ""));
    } else if (tag === "br") {
      out += "<br/>";
    } else if (tag === "tab") {
      out += "&emsp;";
    }
  }
  if (!matched) {
    // Fallback: strip tags.
    const stripped = paragraphXml.replace(/<[^>]+>/g, "");
    out = escapeHtml(decodeXmlEntities(stripped));
  }
  const isHeading = /<w:pStyle\s+w:val="[^"]*[Hh]eading[^"]*"/.test(paragraphXml);
  const content = out.trim();
  if (!content) return "<p>&nbsp;</p>";
  return isHeading ? `<h3>${content}</h3>` : `<p>${content}</p>`;
}

function documentXmlToHtml(xml: string): string {
  const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const blocks: string[] = [];
  // Walk paragraphs and tables in document order.
  const blockRegex = /<w:p\b[\s\S]*?<\/w:p>|<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(body))) {
    const chunk = match[0];
    if (chunk.startsWith("<w:tbl")) {
      const rows: string[] = [];
      const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(chunk))) {
        const cells: string[] = [];
        const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(rowMatch[0]))) {
          const cellParas: string[] = [];
          const paraRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
          let paraMatch: RegExpExecArray | null;
          while ((paraMatch = paraRegex.exec(cellMatch[0]))) {
            cellParas.push(paragraphToHtml(paraMatch[0]));
          }
          cells.push(`<td>${cellParas.join("") || "&nbsp;"}</td>`);
        }
        rows.push(`<tr>${cells.join("")}</tr>`);
      }
      blocks.push(`<table>${rows.join("")}</table>`);
    } else {
      blocks.push(paragraphToHtml(chunk));
    }
  }

  return blocks.join("\n");
}

function buildHtml(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 18mm; }
    body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.5; }
    h3 { font-size: 13pt; margin: 14px 0 6px; }
    p { margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
  </style></head><body>${bodyHtml}</body></html>`;
}

/**
 * Render a DOCX file to PDF. Returns the output PDF path, or null on failure.
 * Pass an existing Browser to reuse the scraping session; otherwise a new one
 * is launched and closed.
 */
export async function convertDocxToPdf(
  docxPath: string,
  options: { browser?: import("puppeteer-core").Browser } = {},
): Promise<string | null> {
  let html: string;
  try {
    const buffer = await readFile(docxPath);
    const entries = readCentralDirectory(buffer);
    const docEntry = entries.find((entry) => entry.name === "word/document.xml");
    if (!docEntry) throw new Error("DOCX has no word/document.xml");
    const xml = readEntryData(buffer, docEntry).toString("utf8");
    html = buildHtml(basename(docxPath), documentXmlToHtml(xml));
  } catch (error) {
    logger.warn("DOCX->PDF: failed to read/convert document", error);
    return null;
  }

  const ownBrowser = !options.browser;
  let browser = options.browser ?? null;
  try {
    if (!browser) browser = await launchBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const outputPath = join(paths.downloads, `${basename(docxPath)}.pdf`);
      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
      });
      return outputPath;
    } finally {
      await page.close().catch(() => null);
    }
  } catch (error) {
    logger.warn("DOCX->PDF: Chrome render failed", error);
    return null;
  } finally {
    if (ownBrowser && browser) await browser.close().catch(() => null);
  }
}
