import type { Hono } from "hono";
import { z } from "zod";
import { MoodleAuthService } from "../moodle/moodle-auth.service";

export function registerMoodleRoutes(app: Hono) {
  app.post("/api/moodle/login", async (c) => {
    const body = z.object({ url: z.string().url() }).parse(await c.req.json());
    const result = await new MoodleAuthService().openLogin(body.url);
    return c.json(result);
  });
}
