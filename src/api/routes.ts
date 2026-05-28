import type { Hono } from "hono";
import { registerMoodleRoutes } from "./moodle.routes";
import { registerActivityRoutes } from "./activity.routes";
import { registerStudentRoutes } from "./student.routes";
import { registerAssessmentRoutes } from "./assessment.routes";
import { registerAiSettingRoutes } from "./ai-setting.routes";

export function registerRoutes(app: Hono) {
  registerMoodleRoutes(app);
  registerActivityRoutes(app);
  registerStudentRoutes(app);
  registerAssessmentRoutes(app);
  registerAiSettingRoutes(app);
}
