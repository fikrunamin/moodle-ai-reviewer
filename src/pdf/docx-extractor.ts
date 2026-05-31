import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

/**
 * Minimal ZIP reader for DOCX. A .docx is a ZIP archive; the document body
 * lives in word/document.xml. We avoid external deps (keeps the compiled
 * Bun executable portable) by parsing the ZIP central directory ourselves
 * and inflating the needed entry with node:zlib.
 */

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer): number {
  // EOCD is at the end; scan backwards (comment can be up to 64KB).
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

  if (entry.compressionMethod === 0) return Buffer.from(data); // stored
  if (entry.compressionMethod === 8) return inflateRawSync(data); // deflate
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod}`);
}

function xmlToText(xml: string): string {
  return (
    xml
      // Paragraph and line breaks become newlines.
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br\s*\/?>/g, "\n")
      .replace(/<w:tab\s*\/?>/g, "\t")
      // Table rows -> newline, cells -> tab separation.
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      // Strip all remaining tags.
      .replace(/<[^>]+>/g, "")
      // Decode common XML entities.
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      // Collapse excessive whitespace while keeping line structure.
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

export async function extractDocxText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const entries = readCentralDirectory(buffer);

  // Main body plus headers/footers, joined in a sensible order.
  const targets = entries
    .filter((entry) => /^word\/(document\.xml|header\d*\.xml|footer\d*\.xml)$/.test(entry.name))
    .sort((a, b) => {
      const rank = (name: string) => (name === "word/document.xml" ? 0 : name.includes("header") ? -1 : 1);
      return rank(a.name) - rank(b.name);
    });

  if (targets.length === 0) {
    throw new Error("DOCX has no word/document.xml");
  }

  const parts: string[] = [];
  for (const entry of targets) {
    const data = readEntryData(buffer, entry);
    const text = xmlToText(data.toString("utf8"));
    if (text) parts.push(text);
  }

  return parts.join("\n\n").trim();
}
