import type { Browser, Page } from "puppeteer-core";

export class MoodleSession {
  constructor(private readonly browser: Browser) {}

  async newPage(url?: string): Promise<Page> {
    const page = await this.browser.newPage();
    if (url) {
      await page.goto(url, { waitUntil: "networkidle2" });
    }
    return page;
  }
}
