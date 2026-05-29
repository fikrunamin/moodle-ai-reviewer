import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Hono } from "hono";
import { paths } from "../runtime/paths";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { ReferenceRepository } from "../database/repositories/reference.repository";

function isInsidePath(filePath: string, base: string) {
  const resolved = resolve(filePath);
  const baseResolved = resolve(base);
  const relativePath = relative(baseResolved, resolved);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isInsideDownloads(filePath: string) {
  return isInsidePath(filePath, paths.downloads);
}

function isInsideReferences(filePath: string) {
  return isInsidePath(filePath, paths.references);
}

function pdfResponse(filePath: string) {
  return new Response(Bun.file(filePath), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export function registerFileRoutes(app: Hono) {
  app.get("/api/files/:fileId/preview", (c) => {
    const file = new SubmissionRepository().findFile(c.req.param("fileId"));
    if (!file) return c.json({ error: "File not found" }, 404);
    const resolved = resolve(file.file_path);

    if (!isInsideDownloads(resolved)) {
      return c.json({ error: "File path is outside downloads folder" }, 403);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: "File not found on disk" }, 404);
    }

    return pdfResponse(resolved);
  });

  app.get("/api/files/preview", (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Missing file path" }, 400);

    const resolved = resolve(filePath);
    if (!isInsideDownloads(resolved)) {
      return c.json({ error: "File path is outside downloads folder" }, 403);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: "File not found" }, 404);
    }

    return pdfResponse(resolved);
  });

  app.get("/api/references/:refId/preview", (c) => {
    const reference = new ReferenceRepository().find(c.req.param("refId"));
    if (!reference) return c.json({ error: "Reference not found" }, 404);
    if (!reference.resolved_pdf_path) {
      return c.json({ error: "Reference PDF not available" }, 404);
    }
    const resolved = resolve(reference.resolved_pdf_path);
    if (!isInsideReferences(resolved)) {
      return c.json({ error: "Reference path is outside references folder" }, 403);
    }
    if (!existsSync(resolved)) {
      return c.json({ error: "Reference PDF missing on disk" }, 404);
    }
    return pdfResponse(resolved);
  });
}
