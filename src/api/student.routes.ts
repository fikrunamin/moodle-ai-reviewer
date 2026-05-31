import type { Hono } from "hono";
import { z } from "zod";
import { StudentRepository } from "../database/repositories/student.repository";
import { getDb } from "../database/db";
import { ActivityRepository } from "../database/repositories/activity.repository";

export function registerStudentRoutes(app: Hono) {
  app.get("/api/activities/:activityId/students", (c) => {
    const activityId = c.req.param("activityId");
    const students = getDb()
      .query(
        `SELECT s.*,
                EXISTS(
                  SELECT 1
                  FROM moodle_submissions sub
                  JOIN extracted_links link ON link.submission_id = sub.id
                  WHERE sub.student_id = s.id AND link.kind = 'youtube'
                ) AS has_youtube_link
         FROM moodle_students s
         WHERE s.activity_id = ?
         ORDER BY s.student_name ASC`,
      )
      .all(activityId);
    return c.json(students);
  });

  // App-only bulk delete. Does NOT delete anything in Moodle.
  app.post("/api/students/delete-bulk", async (c) => {
    const parsed = z
      .object({ studentIds: z.array(z.string()).min(1), activityId: z.string().optional() })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "studentIds wajib diisi" }, 400);
    const deleted = new StudentRepository().deleteMany(parsed.data.studentIds);
    if (parsed.data.activityId) new ActivityRepository().refreshCounts(parsed.data.activityId);
    return c.json({ deleted });
  });

  // App-only single delete.
  app.delete("/api/students/:studentId", (c) => {
    const studentId = c.req.param("studentId");
    const student = new StudentRepository().find(studentId);
    if (!student) return c.json({ error: "Student not found" }, 404);
    new StudentRepository().deleteMany([studentId]);
    new ActivityRepository().refreshCounts(student.activity_id);
    return c.json({ deleted: 1 });
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
