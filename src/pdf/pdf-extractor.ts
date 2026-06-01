import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { paths } from "../runtime/paths";

interface PdfJsModule {
  getDocument(input: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  getAnnotations(input?: { intent?: string }): Promise<Array<{ url?: string; unsafeUrl?: string }>>;
}

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
  const { getDocument } = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
  const buffer = await readFile(filePath);
  const document = await getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: false,
    useWorkerFetch: false,
    useWasm: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  let text = "";
  const links = new Set<string>();
  try {
    const pageTexts: string[] = [];
    const failedPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      try {
        const page = await document.getPage(pageNumber);
        const result = await page.getTextContent();
        pageTexts.push(result.items.map((item) => item.str ?? "").join(" ").replace(/\s+/g, " ").trim());
        const annotations = await page.getAnnotations({ intent: "display" }).catch(() => []);
        for (const annotation of annotations) {
          const url = annotation.url ?? annotation.unsafeUrl;
          if (url) links.add(url);
        }
      } catch {
        failedPages.push(pageNumber);
      }
    }

    text = pageTexts.filter(Boolean).join("\n\n");
    if (links.size) {
      text += `${text ? "\n\n" : ""}[PDF extracted links]\n${Array.from(links).join("\n")}`;
    }
    if (failedPages.length) {
      text += `\n\n[PDF extraction warning: failed to extract page(s) ${failedPages.join(", ")}.]`;
    }
  } finally {
    await document.destroy().catch(() => null);
  }

  const outputPath = join(paths.extracted, `${basename(filePath)}.txt`);
  await writeFile(outputPath, text, "utf8");
  return { text, outputPath };
}
