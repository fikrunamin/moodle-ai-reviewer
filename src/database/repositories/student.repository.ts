import { getDb } from "../db";
import type { MoodleStudent } from "../../shared/types";

export class StudentRepository {
  listByActivity(activityId: string): MoodleStudent[] {
    return getDb()
      .query("SELECT * FROM moodle_students WHERE activity_id = ? ORDER BY student_name ASC")
      .all(activityId) as MoodleStudent[];
  }
}
