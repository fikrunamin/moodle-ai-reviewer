import type { Hono } from "hono";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { generateAssignmentReviewJob } from "../jobs/generate-assignment-review.job";
import { generateDiscussionReviewJob } from "../jobs/generate-discussion-review.job";
import { aiQueue } from "../jobs/queues";
import { z } from "zod";

export function registerAssessmentRoutes(app: Hono) {
  app.get("/api/students/:studentId/assessment", (c) => {
    const repo = new AssessmentRepository();
    const assessment = repo.findByStudent(c.req.param("studentId"));
    return c.json(assessment ? { ...assessment, scores: repo.listScores(assessment.id) } : null);
  });

  app.post("/api/students/:studentId/generate", async (c) => {
    const studentId = c.req.param("studentId");
    const student = new StudentRepository().find(studentId);
    if (!student) return c.json({ error: "Student not found" }, 404);
    const activity = new ActivityRepository().find(student.activity_id);
    if (!activity) return c.json({ error: "Activity not found" }, 404);
    const result =
      activity.type === "assignment" ? await generateAssignmentReviewJob(studentId) : await generateDiscussionReviewJob(studentId);
    return c.json(result);
  });

  app.post("/api/assessments/generate-bulk", async (c) => {
    const body = z
      .object({
        studentIds: z.array(z.string()).default([]),
        mode: z.enum(["selected", "missing"]).default("selected"),
      })
      .parse(await c.req.json());

    const students = new StudentRepository();
    const activities = new ActivityRepository();
    for (const studentId of body.studentIds) {
      const student = students.find(studentId);
      if (!student) continue;
      if (body.mode === "missing" && student.ai_status === "completed") continue;
      aiQueue.enqueue(async () => {
        const activity = activities.find(student.activity_id);
        if (!activity) return;
        if (activity.type === "assignment") await generateAssignmentReviewJob(studentId);
        else await generateDiscussionReviewJob(studentId);
      });
    }

    return c.json({ queued: true, queue: aiQueue.getStatus() });
  });

  app.get("/api/jobs/ai", (c) => c.json(aiQueue.getStatus()));
}
