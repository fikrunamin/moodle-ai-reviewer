import type { Hono } from "hono";
import { z } from "zod";
import { MoodleActivityService } from "../moodle/moodle-activity.service";
import { syncQueue } from "../jobs/queues";
import { rubricQueue } from "../jobs/queues";
import { syncActivityJob } from "../jobs/sync-activity.job";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { RubricUploadService } from "../moodle/rubric-upload.service";
import { processRubricJob } from "../jobs/process-rubric.job";

export function registerActivityRoutes(app: Hono) {
  const service = new MoodleActivityService();

  app.get("/api/activities", (c) => c.json(service.listActivities()));

  app.post("/api/activities", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const body = z
        .object({
          type: z.enum(["assignment", "discussion"]),
          title: z.string().optional(),
          url: z.string().url(),
        })
        .parse({
          type: form.get("type"),
          title: form.get("title") || undefined,
          url: form.get("url"),
        });

      const rubricFile = form.get("rubricFile");
      const filePath = rubricFile instanceof File && rubricFile.size > 0 ? await new RubricUploadService().saveFile({ file: rubricFile }) : null;
      const activity = service.addActivity({
        ...body,
        rubricStatus: filePath ? "processing" : "none",
      });

      if (filePath) {
        new ActivityRepository().updateRubric(activity.id, { status: "processing", filePath, aiJson: null, error: null });
        rubricQueue.enqueue(async () => {
          await processRubricJob({ activityId: activity.id, activityType: body.type, filePath });
        });
      }

      return c.json({ ...activity, rubric_status: filePath ? "processing" : activity.rubric_status }, 201);
    }

    const body = z.object({ type: z.enum(["assignment", "discussion"]), title: z.string().optional(), url: z.string().url() }).parse(await c.req.json());

    return c.json(service.addActivity(body), 201);
  });

  app.post("/api/activities/:activityId/sync", (c) => {
    const activityId = c.req.param("activityId");
    new ActivityRepository().updateSyncStatus(activityId, "syncing");
    syncQueue.enqueue(async () => {
      await syncActivityJob(activityId);
    });
    return c.json({ queued: true, queue: syncQueue.getStatus() });
  });

  app.get("/api/jobs/sync", (c) => c.json(syncQueue.getStatus()));
  app.get("/api/jobs/rubric", (c) => c.json(rubricQueue.getStatus()));

  app.post("/api/activities/:activityId/rubric", async (c) => {
    const activityId = c.req.param("activityId");
    const activity = new ActivityRepository().find(activityId);
    if (!activity) return c.json({ error: "Activity not found" }, 404);

    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const text = form.get("rubricText");
      const file = form.get("rubricFile");

      if (typeof text === "string" && text.trim()) {
        new ActivityRepository().updateRubricText(activityId, text);
        return c.json(new ActivityRepository().find(activityId));
      }

      if (file instanceof File && file.size > 0) {
        const filePath = await new RubricUploadService().saveFile({ file });
        new ActivityRepository().updateRubric(activityId, { status: "processing", filePath, aiJson: null, error: null });
        rubricQueue.enqueue(async () => {
          await processRubricJob({ activityId, activityType: activity.type, filePath });
        });
        return c.json({ ...new ActivityRepository().find(activityId), rubric_status: "processing" });
      }
    } else {
      const body = z.object({ rubricText: z.string().min(1) }).parse(await c.req.json());
      new ActivityRepository().updateRubricText(activityId, body.rubricText);
      return c.json(new ActivityRepository().find(activityId));
    }

    return c.json({ error: "Provide rubricText or rubricFile" }, 400);
  });
}
