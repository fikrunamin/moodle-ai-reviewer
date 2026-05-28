import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PDFParse } from "pdf-parse";
import { paths } from "../runtime/paths";

export async function extractPdfText(filePath: string) {
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const outputPath = join(paths.extracted, `${basename(filePath)}.txt`);
  await writeFile(outputPath, result.text, "utf8");
  return { text: result.text, outputPath };
}
