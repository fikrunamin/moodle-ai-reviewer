import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Hono } from "hono";
import { paths } from "../runtime/paths";
import { SubmissionRepository } from "../database/repositories/submission.repository";

function isInsideDownloads(filePath: string) {
  const resolved = resolve(filePath);
  const downloadsRoot = resolve(paths.downloads);
  const relativePath = relative(downloadsRoot, resolved);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
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
}
