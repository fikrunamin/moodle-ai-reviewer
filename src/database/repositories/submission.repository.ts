import { getDb } from "../db";
import { nanoid } from "nanoid";
import type { MoodleSubmission, MoodleSubmissionFile } from "../../shared/types";

export class SubmissionRepository {
  clearMoodleDataForActivity(activityId: string) {
    const db = getDb();
    const tx = db.transaction(() => {
      db.query(
        "DELETE FROM moodle_submission_files WHERE submission_id IN (SELECT id FROM moodle_submissions WHERE activity_id = ?)",
      ).run(activityId);
      db.query("DELETE FROM moodle_submissions WHERE activity_id = ?").run(activityId);
      db.query("DELETE FROM moodle_discussion_posts WHERE activity_id = ?").run(activityId);
    });
    tx();
  }

  findByStudent(studentId: string) {
    return getDb()
      .query("SELECT * FROM moodle_submissions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(studentId) as MoodleSubmission | null;
  }

  find(submissionId: string) {
    return (
      (getDb()
        .query("SELECT * FROM moodle_submissions WHERE id = ?")
        .get(submissionId) as MoodleSubmission | null) ?? null
    );
  }

  listFiles(submissionId: string) {
    return getDb()
      .query("SELECT * FROM moodle_submission_files WHERE submission_id = ? ORDER BY created_at ASC")
      .all(submissionId) as MoodleSubmissionFile[];
  }

  findFile(fileId: string) {
    return getDb()
      .query("SELECT * FROM moodle_submission_files WHERE id = ?")
      .get(fileId) as MoodleSubmissionFile | null;
  }

  upsert(input: {
    activityId: string;
    studentId: string;
    submissionText?: string | null;
    extractedText?: string | null;
    submittedAt?: string | null;
  }) {
    const existing = this.findByStudent(input.studentId);
    if (existing) {
      getDb()
        .query(
          "UPDATE moodle_submissions SET submission_text = ?, extracted_text = ?, submitted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(input.submissionText ?? null, input.extractedText ?? null, input.submittedAt ?? null, existing.id);
      return existing.id;
    }

    const id = nanoid();
    getDb()
      .query(
        "INSERT INTO moodle_submissions (id, activity_id, student_id, submission_text, extracted_text, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, input.activityId, input.studentId, input.submissionText ?? null, input.extractedText ?? null, input.submittedAt ?? null);
    return id;
  }

  addFile(input: { submissionId: string; filename: string; mimeType?: string | null; filePath: string; extractedTextPath?: string | null }) {
    const id = nanoid();
    getDb()
      .query(
        "INSERT INTO moodle_submission_files (id, submission_id, filename, mime_type, file_path, extracted_text_path) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, input.submissionId, input.filename, input.mimeType ?? null, input.filePath, input.extractedTextPath ?? null);
    return id;
  }
}
