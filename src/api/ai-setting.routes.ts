import type { Hono } from "hono";
import { z } from "zod";
import { AiSettingRepository } from "../database/repositories/ai-setting.repository";
import { AiClient } from "../ai/ai-client";

function maskSetting(setting: ReturnType<AiSettingRepository["getActive"]>) {
  if (!setting) return null;
  return {
    ...setting,
    api_key_encrypted: setting.api_key_encrypted ? "********" : null,
  };
}

export function registerAiSettingRoutes(app: Hono) {
  const schema = z.object({
    providerName: z.string().min(1),
    baseUrl: z.string().url(),
    apiKey: z.string().min(1),
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
    const result = await new AiClient({
      baseUrl: body.baseUrl.replace(/\/$/, ""),
      apiKey: body.apiKey,
      model: body.modelName,
    }).testConnection();
    return c.json(result);
  });
}
