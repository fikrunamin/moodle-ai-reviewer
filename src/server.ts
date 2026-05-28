import { Hono } from "hono";
import { cors } from "hono/cors";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./shared/logger";
import { registerRoutes } from "./api/routes";
import { paths } from "./runtime/paths";

function contentType(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

export function startServer(port: number) {
  const app = new Hono();

  app.use("*", cors());
  app.get("/health", (c) => c.json({ ok: true }));

  registerRoutes(app);
  app.get("*", async (c) => {
    const requestPath = new URL(c.req.url).pathname;
    const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
    const webRoot = existsSync(paths.webDist) ? paths.webDist : paths.sourceWebDist;
    const filePath = join(webRoot, relativePath);
    const fallbackPath = join(webRoot, "index.html");

    if (existsSync(filePath)) {
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": contentType(filePath) },
      });
    }

    if (existsSync(fallbackPath)) {
      return new Response(Bun.file(fallbackPath), {
        headers: { "Content-Type": contentType(fallbackPath) },
      });
    }

    return c.text("Moodle AI Review Assistant API is running. Build the web app to serve UI.", 200);
  });

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  logger.info(`Listening on port ${port}`);
  return server;
}
