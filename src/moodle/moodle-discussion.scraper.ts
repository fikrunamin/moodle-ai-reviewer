import type { Page } from "puppeteer-core";
import { moodleSelectors } from "./moodle-selectors";

export interface ScrapedDiscussionPost {
  moodlePostId: string;
  parentMoodlePostId?: string | null;
  subject?: string | null;
  studentName: string;
  authorRole: "student" | "tutor" | "system" | "unknown";
  authorUserId?: string | null;
  authorProfileUrl?: string | null;
  content: string;
  replyTo?: string | null;
  postedAt?: string | null;
  hasRatingMenu: boolean;
  ratingMax?: number | null;
  isFirstPost: boolean;
}

export interface ScrapedDiscussion {
  title: string;
  courseContext: string;
  prompt: string;
  ratingMax?: number | null;
  posts: ScrapedDiscussionPost[];
}

export class MoodleDiscussionScraper {
  async scrape(page: Page): Promise<ScrapedDiscussion> {
    return page.evaluate((selectors) => {
      const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const attr = (element: Element | null, name: string) => element?.getAttribute(name)?.trim() || null;
      const title = text(document.querySelector(selectors.activityTitle)) || document.title || "Moodle Discussion";
      const breadcrumb = Array.from(document.querySelectorAll(".breadcrumb a, nav[aria-label='breadcrumb'] a, .breadcrumb-item a"))
        .map((element) => text(element))
        .filter(Boolean);
      const courseHeading = text(document.querySelector(".page-header-headings h1")) || text(document.querySelector("h1")) || title;
      const courseContext = Array.from(new Set([...breadcrumb, courseHeading])).join(" > ");

      const articles = Array.from(document.querySelectorAll("article[data-region='post'][data-post-id], article.forum-post-container[data-post-id]"));
      const firstArticle = articles.find((article) => article.querySelector(".firstpost, .starter")) ?? articles[0] ?? null;
      const firstPostId = attr(firstArticle, "data-post-id");

      function cleanContent(root: Element | null) {
        if (!root) return "";
        const clone = root.cloneNode(true) as Element;
        clone.querySelectorAll("script, style, form, .ratingform, .rating-aggregate-container").forEach((element) => element.remove());
        return text(clone);
      }

      function ratingMax(article: Element) {
        const options = Array.from(article.querySelectorAll("select[name='rating'] option")) as HTMLOptionElement[];
        const values = options
          .map((option) => Number(option.value))
          .filter((value) => Number.isFinite(value) && value >= 0);
        return values.length ? Math.max(...values) : null;
      }

      function authorInfo(article: Element) {
        const header = article.querySelector("header");
        const authorLink = header?.querySelector("a[href*='user/view.php']") as HTMLAnchorElement | null;
        const profileUrl = authorLink?.href ?? null;
        const userId = profileUrl ? new URL(profileUrl, location.href).searchParams.get("id") : null;
        const author = text(authorLink) || text(header?.querySelector("[class*='author']") ?? null);
        return { author, profileUrl, userId };
      }

      const posts = articles
        .map((post, index) => {
          const ownPost = post.querySelector(":scope > [data-content='forum-post'], :scope > .forumpost") ?? post;
          const moodlePostId = attr(post, "data-post-id") ?? attr(post.querySelector("[data-post-id]"), "data-post-id") ?? `post-${index}`;
          const parentArticle = post.parentElement?.closest("article[data-region='post'][data-post-id]") as HTMLElement | null;
          const parentMoodlePostId = parentArticle?.getAttribute("data-post-id") ?? null;
          const subject = text(ownPost.querySelector("[data-region-content='forum-post-core-subject'], h3, h4"));
          const content = cleanContent(ownPost.querySelector(`#post-content-${CSS.escape(moodlePostId)}`)) || cleanContent(ownPost.querySelector(".post-content-container"));
          const srReply = text(ownPost.querySelector("header .sr-only"));
          const replyTo = srReply.match(/In reply to\s+(.+)/i)?.[1]?.trim() ?? null;
          const time = ownPost.querySelector("time") as HTMLTimeElement | null;
          const postedAt = time?.dateTime || time?.getAttribute("datetime") || time?.textContent?.trim() || null;
          const { author, profileUrl, userId } = authorInfo(ownPost);
          const hasRatingMenu = Boolean(ownPost.querySelector("select[name='rating'].postratingmenu, select[name='rating']"));
          const isFirstPost =
            moodlePostId === firstPostId ||
            ownPost.classList.contains("firstpost") ||
            ownPost.classList.contains("starter") ||
            ownPost.querySelector(".firstpost, .starter") !== null;
          const authorRole: "student" | "tutor" | "system" | "unknown" = isFirstPost
            ? "system"
            : hasRatingMenu
              ? "student"
              : author
                ? "tutor"
                : "unknown";
          return {
            moodlePostId,
            parentMoodlePostId,
            subject: subject || null,
            studentName: isFirstPost ? "First post" : author || "Unknown",
            authorRole,
            authorUserId: userId,
            authorProfileUrl: profileUrl,
            content,
            replyTo,
            postedAt,
            hasRatingMenu,
            ratingMax: ratingMax(ownPost),
            isFirstPost,
          };
        })
        .filter((post) => post.content.length > 0 || post.isFirstPost);

      const firstPost = posts.find((post) => post.isFirstPost) ?? null;
      const maxRatings = posts
        .map((post) => post.ratingMax)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return {
        title,
        courseContext,
        prompt: firstPost?.content || text(document.querySelector(selectors.regionMain)),
        ratingMax: maxRatings.length ? Math.max(...maxRatings) : null,
        posts,
      };
    }, moodleSelectors);
  }
}
