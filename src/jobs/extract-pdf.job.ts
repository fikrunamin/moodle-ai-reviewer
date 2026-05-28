import { extractPdfText } from "../pdf/pdf-extractor";

export async function extractPdfJob(filePath: string) {
  return extractPdfText(filePath);
}
