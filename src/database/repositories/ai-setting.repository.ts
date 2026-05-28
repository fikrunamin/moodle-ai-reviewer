import { getDb } from "../db";
import { nanoid } from "nanoid";
import type { AiSetting } from "../../shared/types";

export class AiSettingRepository {
  getActive() {
    return getDb().query("SELECT * FROM ai_settings WHERE is_active = 1 LIMIT 1").get() as AiSetting | null;
  }

  save(input: { providerName: string; baseUrl: string; apiKey?: string; modelName: string }) {
    const db = getDb();
    const existing = this.getActive();
    const apiKey = input.apiKey?.trim() && input.apiKey !== "********" ? input.apiKey : existing?.api_key_encrypted;
    if (!apiKey) {
      throw new Error("API key is required. Paste the real API key before saving.");
    }

    const id = nanoid();
    const tx = db.transaction(() => {
      db.query("UPDATE ai_settings SET is_active = 0").run();
      db.query(
        "INSERT INTO ai_settings (id, provider_name, base_url, api_key_encrypted, model_name, is_active) VALUES (?, ?, ?, ?, ?, 1)",
      ).run(id, input.providerName, input.baseUrl.replace(/\/$/, ""), apiKey, input.modelName);
    });
    tx();
    return this.getActive();
  }
}
