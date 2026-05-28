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
}
