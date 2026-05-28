import { getDb } from "../db";

export class AssessmentRepository {
  findByStudent(studentId: string) {
    return getDb()
      .query("SELECT * FROM ai_assessments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(studentId);
  }
}
