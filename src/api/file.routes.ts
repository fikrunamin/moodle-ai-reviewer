import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Hono } from "hono";
import { paths } from "../runtime/paths";

export function registerFileRoutes(app: Hono) {
  app.get("/api/files/preview", (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "Missing file path" }, 400);

    const resolved = resolve(filePath);
    const downloadsRoot = resolve(paths.downloads);
    if (!resolved.startsWith(downloadsRoot)) {
      return c.json({ error: "File path is outside downloads folder" }, 403);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: "File not found" }, 404);
    }

    return new Response(Bun.file(resolved), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
      },
    });
  });
}
