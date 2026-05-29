import { nanoid } from "nanoid";
import { getDb } from "../db";
import type { ExtractedLink, ExtractedLinkKind, OembedStatus } from "../../shared/types";

export class ExtractedLinkRepository {
  listBySubmission(submissionId: string): ExtractedLink[] {
    return getDb()
      .query(
        "SELECT * FROM extracted_links WHERE submission_id = ? ORDER BY kind ASC, created_at ASC",
      )
      .all(submissionId) as ExtractedLink[];
  }

  find(id: string): ExtractedLink | null {
    return (
      (getDb().query("SELECT * FROM extracted_links WHERE id = ?").get(id) as ExtractedLink | null) ??
      null
    );
  }

  replaceForSubmission(
    submissionId: string,
    links: Array<{
      url: string;
      kind: ExtractedLinkKind;
      fileId?: string | null;
      youtubeVideoId?: string | null;
      youtubeTitle?: string | null;
      youtubeAuthor?: string | null;
      youtubeThumbnailUrl?: string | null;
      oembedStatus?: OembedStatus | null;
    }>,
  ) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.query("DELETE FROM extracted_links WHERE submission_id = ?").run(submissionId);
      const insert = db.query(
        "INSERT INTO extracted_links (id, submission_id, file_id, url, kind, youtube_video_id, youtube_title, youtube_author, youtube_thumbnail_url, oembed_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const link of links) {
        insert.run(
          nanoid(),
          submissionId,
          link.fileId ?? null,
          link.url,
          link.kind,
          link.youtubeVideoId ?? null,
          link.youtubeTitle ?? null,
          link.youtubeAuthor ?? null,
          link.youtubeThumbnailUrl ?? null,
          link.oembedStatus ?? null,
        );
      }
    });
    tx();
  }

  updateYoutubeMeta(
    id: string,
    meta: {
      youtubeTitle?: string | null;
      youtubeAuthor?: string | null;
      youtubeThumbnailUrl?: string | null;
      oembedStatus: OembedStatus;
    },
  ) {
    getDb()
      .query(
        "UPDATE extracted_links SET youtube_title = ?, youtube_author = ?, youtube_thumbnail_url = ?, oembed_status = ? WHERE id = ?",
      )
      .run(
        meta.youtubeTitle ?? null,
        meta.youtubeAuthor ?? null,
        meta.youtubeThumbnailUrl ?? null,
        meta.oembedStatus,
        id,
      );
  }
}
