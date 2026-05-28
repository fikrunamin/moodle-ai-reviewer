import type { Hono } from "hono";
import { StudentRepository } from "../database/repositories/student.repository";

export function registerStudentRoutes(app: Hono) {
  app.get("/api/activities/:activityId/students", (c) => {
    return c.json(new StudentRepository().listByActivity(c.req.param("activityId")));
  });
}
