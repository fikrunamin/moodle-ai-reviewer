import type { Hono } from "hono";
import { z } from "zod";
import { AiSettingRepository } from "../database/repositories/ai-setting.repository";
import { AiClient } from "../ai/ai-client";
import { logger } from "../shared/logger";

function maskSetting(setting: ReturnType<AiSettingRepository["getActive"]>) {
  if (!setting) return null;
  return {
    ...setting,
    api_key_encrypted: setting.api_key_encrypted ? "********" : null,
    has_api_key: Boolean(setting.api_key_encrypted),
  };
}

export function registerAiSettingRoutes(app: Hono) {
  const schema = z.object({
    providerName: z.string().min(1),
    baseUrl: z.string().url(),
    apiKey: z.string().optional(),
    modelName: z.string().min(1),
  });

  app.get("/api/ai-settings/active", (c) => {
    return c.json(maskSetting(new AiSettingRepository().getActive()));
  });

  app.post("/api/ai-settings", async (c) => {
    const body = schema.parse(await c.req.json());
    const saved = new AiSettingRepository().save(body);
    return c.json(maskSetting(saved));
  });

  app.post("/api/ai-settings/test", async (c) => {
    const body = schema.parse(await c.req.json());
    const active = new AiSettingRepository().getActive();
    const apiKey = body.apiKey?.trim() && body.apiKey !== "********" ? body.apiKey : active?.api_key_encrypted;
    if (!apiKey) {
      return c.json({ error: "API key is required. Paste the real API key before testing." }, 400);
    }

    try {
      const result = await new AiClient({
        baseUrl: body.baseUrl.replace(/\/$/, ""),
        apiKey,
        model: body.modelName,
      }).testConnection();
      return c.json(result);
    } catch (error) {
      logger.error("AI connection test failed", error);
      return c.json({ error: error instanceof Error ? error.message : "AI connection failed" }, 400);
    }
  });
}
