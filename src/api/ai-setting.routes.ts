import type { Hono } from "hono";
import { AiSettingRepository } from "../database/repositories/ai-setting.repository";

export function registerAiSettingRoutes(app: Hono) {
  app.get("/api/ai-settings/active", (c) => {
    return c.json(new AiSettingRepository().getActive() ?? null);
  });
}
