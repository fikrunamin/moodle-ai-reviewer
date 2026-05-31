import { getDb } from "../db";
import type { MoodleStudent } from "../../shared/types";
import { nanoid } from "nanoid";

export class StudentRepository {
  listByActivity(activityId: string): MoodleStudent[] {
    return getDb()
      .query("SELECT * FROM moodle_students WHERE activity_id = ? ORDER BY student_name ASC")
      .all(activityId) as MoodleStudent[];
  }

  find(id: string): MoodleStudent | null {
    return (getDb().query("SELECT * FROM moodle_students WHERE id = ?").get(id) as MoodleStudent | null) ?? null;
  }

  upsert(input: {
    id?: string;
    activityId: string;
    studentName: string;
    email?: string | null;
    submissionStatus?: string | null;
    interactionCount?: number;
  }): MoodleStudent {
    const existing = getDb()
      .query("SELECT * FROM moodle_students WHERE activity_id = ? AND student_name = ?")
      .get(input.activityId, input.studentName) as MoodleStudent | null;
    const id = existing?.id ?? input.id ?? nanoid();

    if (existing) {
      getDb()
        .query(
          "UPDATE moodle_students SET email = COALESCE(?, email), submission_status = COALESCE(?, submission_status), interaction_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(input.email ?? null, input.submissionStatus ?? null, input.interactionCount ?? existing.interaction_count ?? 0, id);
    } else {
      getDb()
        .query(
          "INSERT INTO moodle_students (id, activity_id, student_name, email, submission_status, interaction_count) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, input.activityId, input.studentName, input.email ?? null, input.submissionStatus ?? null, input.interactionCount ?? 0);
    }

    return this.find(id)!;
  }

  updateAiStatus(id: string, status: string, recommendedScore: number | null = null) {
    getDb()
      .query("UPDATE moodle_students SET ai_status = ?, recommended_score = COALESCE(?, recommended_score), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(status, recommendedScore, id);
  }

  // App-only delete. Does NOT touch Moodle, only removes local rows.
  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const db = getDb();
    const placeholders = ids.map(() => "?").join(", ");
    const tx = db.transaction(() => {
      db.query(
        `DELETE FROM pdf_summaries WHERE file_id IN (
           SELECT f.id FROM moodle_submission_files f
           JOIN moodle_submissions s ON s.id = f.submission_id
           WHERE s.student_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM extracted_links WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE student_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM extracted_references WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE student_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM moodle_submission_files WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE student_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(`DELETE FROM moodle_submissions WHERE student_id IN (${placeholders})`).run(...ids);
      db.query(`DELETE FROM moodle_discussion_posts WHERE student_id IN (${placeholders})`).run(...ids);
      db.query(
        `DELETE FROM ai_assessment_scores WHERE assessment_id IN (
           SELECT id FROM ai_assessments WHERE student_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(`DELETE FROM ai_assessments WHERE student_id IN (${placeholders})`).run(...ids);
      db.query(`DELETE FROM moodle_students WHERE id IN (${placeholders})`).run(...ids);
    });
    tx();
    return ids.length;
  }
}
