import { getDb } from "../db";

export class AiSettingRepository {
  getActive() {
    return getDb().query("SELECT * FROM ai_settings WHERE is_active = 1 LIMIT 1").get();
  }
}
