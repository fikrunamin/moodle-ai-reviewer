import { logger } from "../shared/logger";

const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{6,}$/;

export function extractYoutubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
      return VIDEO_ID_REGEX.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return VIDEO_ID_REGEX.test(id) ? id : null;
      }
      const segments = url.pathname.split("/").filter(Boolean);
      // /shorts/:id, /embed/:id, /v/:id, /live/:id
      if (segments.length >= 2 && ["shorts", "embed", "v", "live"].includes(segments[0]!)) {
        const id = segments[1] ?? "";
        return VIDEO_ID_REGEX.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface YoutubeOembedResult {
  ok: boolean;
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
}

export async function fetchYoutubeOembed(videoUrl: string): Promise<YoutubeOembedResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  try {
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "MoodleAIReviewer/0.3 (+oembed)" },
      signal: AbortSignal.timeout(Number(process.env.YOUTUBE_OEMBED_TIMEOUT_MS ?? 8_000)),
    });
    if (!response.ok) return { ok: false };
    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      ok: true,
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch (error) {
    logger.error?.("YouTube oEmbed failed", error);
    return { ok: false };
  }
}

export function buildEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
