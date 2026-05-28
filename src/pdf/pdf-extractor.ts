import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { paths } from "../runtime/paths";

function ensurePdfRuntimePolyfills() {
  const globalScope = globalThis as {
    DOMMatrix?: unknown;
    ImageData?: unknown;
    Path2D?: unknown;
  };

  if (!globalScope.DOMMatrix) {
    globalScope.DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(init?: number[] | string) {
        if (Array.isArray(init)) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }

      multiply() {
        return this;
      }

      translate() {
        return this;
      }

      scale() {
        return this;
      }
    };
  }

  if (!globalScope.ImageData) {
    globalScope.ImageData = class ImageData {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    };
  }

  if (!globalScope.Path2D) {
    globalScope.Path2D = class Path2D {};
  }
}

export async function extractPdfText(filePath: string) {
  ensurePdfRuntimePolyfills();
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(filePath);
  const parser = new PDFParse({
    data: buffer,
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  let text = "";
  try {
    const info = await parser.getInfo();
    const pageTexts: string[] = [];
    const failedPages: number[] = [];

    for (let page = 1; page <= info.total; page += 1) {
      try {
        const result = await parser.getText({
          partial: [page],
          pageJoiner: "\n-- page_number of total_number --",
        });
        pageTexts.push(result.text.trim());
      } catch {
        failedPages.push(page);
      }
    }

    text = pageTexts.filter(Boolean).join("\n\n");
    if (failedPages.length) {
      text += `\n\n[PDF extraction warning: failed to extract page(s) ${failedPages.join(", ")}.]`;
    }
  } finally {
    await parser.destroy().catch(() => null);
  }

  const outputPath = join(paths.extracted, `${basename(filePath)}.txt`);
  await writeFile(outputPath, text, "utf8");
  return { text, outputPath };
}
