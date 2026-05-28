import { getDb } from "../db";

export class SubmissionRepository {
  findByStudent(studentId: string) {
    return getDb()
      .query("SELECT * FROM moodle_submissions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(studentId);
  }
}
