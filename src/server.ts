import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./shared/logger";
import { registerRoutes } from "./api/routes";

export function startServer(port: number) {
  const app = new Hono();

  app.use("*", cors());
  app.get("/health", (c) => c.json({ ok: true }));

  registerRoutes(app);

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  logger.info(`Listening on port ${port}`);
  return server;
}
