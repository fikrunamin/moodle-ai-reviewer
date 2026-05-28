import type { Hono } from "hono";
import { UpdateService } from "../update/update.service";
import { logger } from "../shared/logger";

export function registerUpdateRoutes(app: Hono) {
  app.get("/api/update/check", async (c) => {
    try {
      return c.json(await new UpdateService().check());
    } catch (error) {
      logger.error("Update check failed", error);
      return c.json({ error: error instanceof Error ? error.message : "Update check failed" }, 502);
    }
  });

  app.post("/api/update/open-latest", async (c) => {
    try {
      return c.json(await new UpdateService().openLatestRelease());
    } catch (error) {
      logger.error("Open update release failed", error);
      return c.json({ error: error instanceof Error ? error.message : "Open update release failed" }, 502);
    }
  });

  app.post("/api/update/apply", async (c) => {
    try {
      return c.json(await new UpdateService().applyLatestUpdate());
    } catch (error) {
      logger.error("Apply update failed", error);
      return c.json({ error: error instanceof Error ? error.message : "Apply update failed" }, 502);
    }
  });
}
