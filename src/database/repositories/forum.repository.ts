import { nanoid } from "nanoid";
import { getDb } from "../db";
import type { ForumReference, ForumReplySuggestion, MoodleDiscussionPost } from "../../shared/types";
import type { ParsedReferenceInput } from "./reference.repository";

export interface ForumPostInput {
  activityId: string;
  studentId?: string | null;
  moodlePostId?: string | null;
  parentMoodlePostId?: string | null;
  subject?: string | null;
  content: string;
  replyTo?: string | null;
  authorName: string;
  authorRole?: "student" | "tutor" | "system" | "unknown" | null;
  authorUserId?: string | null;
  authorProfileUrl?: string | null;
  postedAt?: string | null;
  hasRatingMenu?: boolean;
  ratingMax?: number | null;
  isFirstPost?: boolean;
}

export class ForumRepository {
  clearActivity(activityId: string) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.query("DELETE FROM forum_references WHERE activity_id = ?").run(activityId);
      db.query("DELETE FROM forum_reply_suggestions WHERE activity_id = ?").run(activityId);
      db.query("DELETE FROM moodle_discussion_posts WHERE activity_id = ?").run(activityId);
    });
    tx();
  }

  addPost(input: ForumPostInput) {
    const id = nanoid();
    getDb()
      .query(
        `INSERT INTO moodle_discussion_posts
          (id, activity_id, student_id, moodle_post_id, parent_moodle_post_id, subject, content, reply_to,
           author_name, author_role, author_user_id, author_profile_url, posted_at, has_rating_menu, rating_max, is_first_post)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.activityId,
        input.studentId ?? null,
        input.moodlePostId ?? null,
        input.parentMoodlePostId ?? null,
        input.subject ?? null,
        input.content,
        input.replyTo ?? null,
        input.authorName,
        input.authorRole ?? "unknown",
        input.authorUserId ?? null,
        input.authorProfileUrl ?? null,
        input.postedAt ?? null,
        input.hasRatingMenu ? 1 : 0,
        input.ratingMax ?? null,
        input.isFirstPost ? 1 : 0,
      );
    return id;
  }

  listPostsByStudent(studentId: string): MoodleDiscussionPost[] {
    return getDb()
      .query(
        `SELECT * FROM moodle_discussion_posts
         WHERE student_id = ?
         ORDER BY COALESCE(posted_at, created_at) ASC, created_at ASC`,
      )
      .all(studentId) as MoodleDiscussionPost[];
  }

  listStudentAuthoredPosts(studentId: string): MoodleDiscussionPost[] {
    return getDb()
      .query(
        `SELECT * FROM moodle_discussion_posts
         WHERE student_id = ? AND author_role = 'student'
         ORDER BY COALESCE(posted_at, created_at) ASC, created_at ASC`,
      )
      .all(studentId) as MoodleDiscussionPost[];
  }

  firstPost(activityId: string): MoodleDiscussionPost | null {
    return (
      (getDb()
        .query("SELECT * FROM moodle_discussion_posts WHERE activity_id = ? AND is_first_post = 1 ORDER BY created_at ASC LIMIT 1")
        .get(activityId) as MoodleDiscussionPost | null) ?? null
    );
  }

  latestReplySuggestion(studentId: string): ForumReplySuggestion | null {
    return (
      (getDb()
        .query("SELECT * FROM forum_reply_suggestions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(studentId) as ForumReplySuggestion | null) ?? null
    );
  }

  saveReplySuggestion(input: { activityId: string; studentId: string; suggestion: string; rawJson: unknown }) {
    const id = nanoid();
    getDb()
      .query(
        "INSERT INTO forum_reply_suggestions (id, activity_id, student_id, suggestion, raw_json) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, input.activityId, input.studentId, input.suggestion, JSON.stringify(input.rawJson ?? null));
    return this.latestReplySuggestion(input.studentId)!;
  }
}

export class ForumReferenceRepository {
  listByStudent(studentId: string): ForumReference[] {
    return getDb()
      .query("SELECT * FROM forum_references WHERE student_id = ? ORDER BY created_at ASC")
      .all(studentId) as ForumReference[];
  }

  find(id: string): ForumReference | null {
    return (
      (getDb()
        .query("SELECT * FROM forum_references WHERE id = ?")
        .get(id) as ForumReference | null) ?? null
    );
  }

  replaceForStudent(input: {
    activityId: string;
    studentId: string;
    postId?: string | null;
    references: ParsedReferenceInput[];
  }) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.query("DELETE FROM forum_references WHERE student_id = ?").run(input.studentId);
      const insert = db.query(
        `INSERT INTO forum_references
          (id, activity_id, student_id, post_id, raw_text, authors, year, title, source, doi, url, arxiv_id, parse_status, resolve_status, relevance_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', 'pending', 'pending')`,
      );
      for (const ref of input.references) {
        insert.run(
          nanoid(),
          input.activityId,
          input.studentId,
          input.postId ?? null,
          ref.rawText,
          ref.authors ? JSON.stringify(ref.authors) : null,
          ref.year ?? null,
          ref.title ?? null,
          ref.source ?? null,
          ref.doi ?? null,
          ref.url ?? null,
          ref.arxivId ?? null,
        );
      }
    });
    tx();
  }

  setResolveStatus(id: string, status: ForumReference["resolve_status"], error: string | null = null) {
    getDb()
      .query(
        "UPDATE forum_references SET resolve_status = ?, resolve_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(status, error, id);
  }

  setResolved(input: {
    id: string;
    source: ForumReference["resolve_source"];
    pdfPath: string | null;
    pdfUrl: string | null;
    metadata: unknown;
  }) {
    const status: ForumReference["resolve_status"] = input.pdfPath ? "found" : "not_found";
    getDb()
      .query(
        `UPDATE forum_references
         SET resolve_status = ?, resolve_source = ?, resolved_pdf_path = ?, resolved_pdf_url = ?,
             resolved_metadata_json = ?, resolve_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(status, input.source, input.pdfPath, input.pdfUrl, JSON.stringify(input.metadata ?? null), input.id);
  }

  setRelevanceStatus(id: string, status: ForumReference["relevance_status"], error: string | null = null) {
    getDb()
      .query(
        "UPDATE forum_references SET relevance_status = ?, relevance_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(status, error, id);
  }

  setRelevance(id: string, analysis: unknown) {
    getDb()
      .query(
        "UPDATE forum_references SET relevance_status = 'completed', relevance_json = ?, relevance_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(JSON.stringify(analysis ?? null), id);
  }
}
