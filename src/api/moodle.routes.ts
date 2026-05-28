import type { Hono } from "hono";
import { z } from "zod";
import { MoodleAuthService } from "../moodle/moodle-auth.service";

export function registerMoodleRoutes(app: Hono) {
  app.post("/api/moodle/cookies", async (c) => {
    const body = z
      .object({
        baseUrl: z.string().url(),
        cookies: z.string().min(1),
      })
      .parse(await c.req.json());
    const result = await new MoodleAuthService().saveCookies(body);
    return c.json(result);
  });

  app.post("/api/moodle/cookies/test", async (c) => {
    const body = z
      .object({
        baseUrl: z.string().url(),
        cookies: z.string().optional(),
      })
      .parse(await c.req.json());
    const result = await new MoodleAuthService().testCookies(body);
    return c.json(result);
  });

  app.post("/api/moodle/open", async (c) => {
    const body = z.object({ url: z.string().url() }).parse(await c.req.json());
    const result = await new MoodleAuthService().openWithCookies(body.url);
    return c.json(result);
  });
}
