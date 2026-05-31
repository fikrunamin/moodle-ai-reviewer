import { nanoid } from "nanoid";
import { getDb } from "../db";
import type { ActivityType, MoodleActivity } from "../../shared/types";

export class ActivityRepository {
  list(): MoodleActivity[] {
    return getDb()
      .query("SELECT * FROM moodle_activities ORDER BY created_at DESC")
      .all() as MoodleActivity[];
  }

  create(input: {
    type: ActivityType;
    title?: string;
    url: string;
    rubricStatus?: string;
  }): MoodleActivity {
    const id = nanoid();
    const title = input.title?.trim() || "Pending sync";
    getDb()
      .query(
        "INSERT INTO moodle_activities (id, type, title, url, rubric_status) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, input.type, title, input.url, input.rubricStatus ?? "none");
    return getDb().query("SELECT * FROM moodle_activities WHERE id = ?").get(id) as MoodleActivity;
  }

  find(id: string): MoodleActivity | null {
    return (getDb().query("SELECT * FROM moodle_activities WHERE id = ?").get(id) as MoodleActivity | null) ?? null;
  }

  updateSyncStatus(id: string, status: string, syncError: string | null = null) {
    getDb()
      .query(
        "UPDATE moodle_activities SET sync_status = ?, sync_error = ?, last_synced_at = CASE WHEN ? = 'synced' THEN CURRENT_TIMESTAMP ELSE last_synced_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(status, syncError, status, id);
  }

  updateScrapedContent(id: string, input: { title?: string; instruction?: string | null; prompt?: string | null; courseContext?: string | null }) {
    getDb()
      .query(
        "UPDATE moodle_activities SET title = COALESCE(?, title), instruction = COALESCE(?, instruction), prompt = COALESCE(?, prompt), course_context = COALESCE(?, course_context), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(input.title ?? null, input.instruction ?? null, input.prompt ?? null, input.courseContext ?? null, id);
  }

  updateInstructionFiles(id: string, files: unknown) {
    getDb()
      .query("UPDATE moodle_activities SET instruction_files = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(JSON.stringify(files ?? []), id);
  }

  updateInstructionAnalysis(
    id: string,
    input: { docText?: string | null; brief?: string | null },
  ) {
    getDb()
      .query(
        "UPDATE moodle_activities SET instruction_doc_text = COALESCE(?, instruction_doc_text), instruction_brief = COALESCE(?, instruction_brief), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(input.docText ?? null, input.brief ?? null, id);
  }

  refreshCounts(id: string) {
    getDb()
      .query(
        `UPDATE moodle_activities
         SET total_students = (SELECT COUNT(*) FROM moodle_students WHERE activity_id = ?),
             reviewed_students = (SELECT COUNT(*) FROM moodle_students WHERE activity_id = ? AND ai_status = 'completed'),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(id, id, id);
  }

  updateRubric(id: string, input: {
    status: string;
    filePath?: string | null;
    extractedText?: string | null;
    aiJson?: string | null;
    error?: string | null;
  }) {
    getDb()
      .query(
        "UPDATE moodle_activities SET rubric_status = ?, rubric_file_path = COALESCE(?, rubric_file_path), rubric_extracted_text = COALESCE(?, rubric_extracted_text), rubric_ai_json = ?, rubric_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(input.status, input.filePath ?? null, input.extractedText ?? null, input.aiJson ?? null, input.error ?? null, id);
  }

  updateRubricText(id: string, text: string) {
    getDb()
      .query(
        "UPDATE moodle_activities SET rubric_status = 'ready', rubric_extracted_text = ?, rubric_ai_json = NULL, rubric_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(text, id);
  }

  delete(id: string) {
    this.deleteMany([id]);
  }

  deleteMany(ids: string[]) {
    if (ids.length === 0) return 0;
    const db = getDb();
    const placeholders = ids.map(() => "?").join(", ");
    const tx = db.transaction(() => {
      // PDF enrichment data keyed by submission
      db.query(
        `DELETE FROM pdf_summaries WHERE file_id IN (
           SELECT f.id FROM moodle_submission_files f
           JOIN moodle_submissions s ON s.id = f.submission_id
           WHERE s.activity_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM extracted_links WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE activity_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM extracted_references WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE activity_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(
        `DELETE FROM moodle_submission_files WHERE submission_id IN (
           SELECT id FROM moodle_submissions WHERE activity_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(`DELETE FROM moodle_submissions WHERE activity_id IN (${placeholders})`).run(...ids);
      db.query(`DELETE FROM moodle_discussion_posts WHERE activity_id IN (${placeholders})`).run(...ids);
      db.query(
        `DELETE FROM ai_assessment_scores WHERE assessment_id IN (
           SELECT id FROM ai_assessments WHERE activity_id IN (${placeholders})
         )`,
      ).run(...ids);
      db.query(`DELETE FROM ai_assessments WHERE activity_id IN (${placeholders})`).run(...ids);
      db.query(`DELETE FROM moodle_students WHERE activity_id IN (${placeholders})`).run(...ids);
      db.query(`DELETE FROM moodle_activities WHERE id IN (${placeholders})`).run(...ids);
    });
    tx();
    return ids.length;
  }
}
