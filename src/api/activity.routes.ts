import type { Hono } from "hono";
import { z } from "zod";
import { MoodleActivityService } from "../moodle/moodle-activity.service";

export function registerActivityRoutes(app: Hono) {
  const service = new MoodleActivityService();

  app.get("/api/activities", (c) => c.json(service.listActivities()));

  app.post("/api/activities", async (c) => {
    const body = z
      .object({
        type: z.enum(["assignment", "discussion"]),
        title: z.string().min(1),
        url: z.string().url(),
      })
      .parse(await c.req.json());

    return c.json(service.addActivity(body), 201);
  });
}
