import type { Page } from "puppeteer-core";
import { moodleSelectors } from "./moodle-selectors";

export interface ScrapedDiscussionPost {
  studentName: string;
  content: string;
  replyTo?: string | null;
  postedAt?: string | null;
}

export interface ScrapedDiscussion {
  title: string;
  prompt: string;
  posts: ScrapedDiscussionPost[];
}

export class MoodleDiscussionScraper {
  async scrape(page: Page): Promise<ScrapedDiscussion> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const title = text(document.querySelector(selectors.activityTitle)) || document.title || "Moodle Discussion";
      const prompt = text(document.querySelector(selectors.regionMain));

      const posts = Array.from(document.querySelectorAll(selectors.forumPost))
        .map((post) => {
          const author =
            text(post.querySelector(".author a, .author, [class*='author'] a, [class*='user'] a")) ||
            text(post.querySelector("h3, h4")) ||
            "Unknown Student";
          const content = text(post.querySelector(".post-content, .content, .posting, [class*='content']")) || text(post);
          return {
            studentName: author,
            content,
            replyTo: null,
            postedAt: null,
          };
        })
        .filter((post) => post.content.length > 0);

      return { title, prompt, posts };
    }, moodleSelectors);
  }
}
