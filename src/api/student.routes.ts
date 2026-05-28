import type { Hono } from "hono";
import { StudentRepository } from "../database/repositories/student.repository";
import { getDb } from "../database/db";

export function registerStudentRoutes(app: Hono) {
  app.get("/api/activities/:activityId/students", (c) => {
    return c.json(new StudentRepository().listByActivity(c.req.param("activityId")));
  });

  app.get("/api/students/:studentId/detail", (c) => {
    const studentId = c.req.param("studentId");
    const student = new StudentRepository().find(studentId);
    if (!student) return c.json(null, 404);
    const activity = getDb().query("SELECT * FROM moodle_activities WHERE id = ?").get(student.activity_id);
    const submission = getDb().query("SELECT * FROM moodle_submissions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1").get(studentId);
    const files = submission
      ? getDb().query("SELECT * FROM moodle_submission_files WHERE submission_id = ? ORDER BY created_at ASC").all((submission as { id: string }).id)
      : [];
    const posts = getDb().query("SELECT * FROM moodle_discussion_posts WHERE student_id = ? ORDER BY created_at ASC").all(studentId);
    return c.json({ student, activity, submission, files, posts });
  });
}
