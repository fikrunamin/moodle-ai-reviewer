import type { Hono } from "hono";
import { registerMoodleRoutes } from "./moodle.routes";
import { registerActivityRoutes } from "./activity.routes";
import { registerStudentRoutes } from "./student.routes";
import { registerAssessmentRoutes } from "./assessment.routes";
import { registerAiSettingRoutes } from "./ai-setting.routes";
import { registerFileRoutes } from "./file.routes";
import { registerPdfRoutes } from "./pdf.routes";
import { registerForumRoutes } from "./forum.routes";
import { registerUpdateRoutes } from "./update.routes";
import { logger } from "../shared/logger";

export function registerRoutes(app: Hono) {
  app.onError((err, c) => {
    logger.error("Unhandled API error", err);
    return c.json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  });

  registerMoodleRoutes(app);
  registerActivityRoutes(app);
  registerStudentRoutes(app);
  registerAssessmentRoutes(app);
  registerAiSettingRoutes(app);
  registerFileRoutes(app);
  registerPdfRoutes(app);
  registerForumRoutes(app);
  registerUpdateRoutes(app);
}
