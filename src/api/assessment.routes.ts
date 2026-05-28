import type { Hono } from "hono";
import { AssessmentRepository } from "../database/repositories/assessment.repository";

export function registerAssessmentRoutes(app: Hono) {
  app.get("/api/students/:studentId/assessment", (c) => {
    const assessment = new AssessmentRepository().findByStudent(c.req.param("studentId"));
    return c.json(assessment ?? null);
  });
}
