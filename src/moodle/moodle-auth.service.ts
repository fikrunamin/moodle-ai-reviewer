import { launchBrowser } from "../browser/puppeteer-client";
import { MoodleSession } from "../browser/moodle-session";

export class MoodleAuthService {
  async openLogin(url: string) {
    const browser = await launchBrowser();
    const session = new MoodleSession(browser);
    await session.newPage(url);
    return { ok: true };
  }
}
