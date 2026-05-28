import { basename, join } from "node:path";
import { nanoid } from "nanoid";
import { paths } from "../runtime/paths";
import { extractPdfText } from "../pdf/pdf-extractor";
import { RubricGeneratorAgent } from "../ai/rubric-generator.agent";
import { logger } from "../shared/logger";

function timeoutMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `Rubric AI generation timed out after ${process.env.RUBRIC_AI_TIMEOUT_MS ?? 60000}ms. Extracted text will be used.`;
  }
  return "Rubric AI generation skipped or failed. Extracted text will be used.";
}

export class RubricUploadService {
  async saveFile(input: { file: File }) {
    const safeName = basename(input.file.name || "rubric.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = join(paths.rubrics, `${nanoid()}_${safeName}`);
    await Bun.write(filePath, await input.file.arrayBuffer());
    return filePath;
  }

  async processFile(input: { filePath: string; activityType: string }) {
    const extracted = await extractPdfText(input.filePath);
    let generated: unknown = null;

    try {
      generated = await new RubricGeneratorAgent().generate({
        activityType: input.activityType,
        rubricText: extracted.text,
        timeoutMs: Number(process.env.RUBRIC_AI_TIMEOUT_MS ?? 60_000),
      });
    } catch (error) {
      logger.warn(timeoutMessage(error), error instanceof Error ? error.message : error);
    }

    return {
      filePath: input.filePath,
      extractedText: extracted.text,
      aiJson: generated ? JSON.stringify(generated) : null,
    };
  }

  async process(input: { file: File; activityType: string }) {
    const filePath = await this.saveFile({ file: input.file });
    return this.processFile({ filePath, activityType: input.activityType });
  }
}
