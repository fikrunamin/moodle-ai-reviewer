import { AiSettingRepository } from "../database/repositories/ai-setting.repository";
import { AiClient } from "./ai-client";

export class AiProviderService {
  private readonly settings = new AiSettingRepository();

  getClient() {
    const active = this.settings.getActive() as
      | { base_url: string; api_key_encrypted: string; model_name: string }
      | undefined;

    if (!active) {
      throw new Error("No active AI provider configured");
    }

    return new AiClient({
      baseUrl: active.base_url,
      apiKey: active.api_key_encrypted,
      model: active.model_name,
    });
  }
}
