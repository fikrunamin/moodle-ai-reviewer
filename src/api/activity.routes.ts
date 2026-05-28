import type { Hono } from "hono";
import { z } from "zod";
import { MoodleActivityService } from "../moodle/moodle-activity.service";
import { syncQueue } from "../jobs/queues";
import { syncActivityJob } from "../jobs/sync-activity.job";

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

  app.post("/api/activities/:activityId/sync", (c) => {
    const activityId = c.req.param("activityId");
    syncQueue.enqueue(async () => {
      await syncActivityJob(activityId);
    });
    return c.json({ queued: true, queue: syncQueue.getStatus() });
  });

  app.get("/api/jobs/sync", (c) => c.json(syncQueue.getStatus()));
}
