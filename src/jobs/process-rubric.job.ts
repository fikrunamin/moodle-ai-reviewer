import { ActivityRepository } from "../database/repositories/activity.repository";
import { RubricUploadService } from "../moodle/rubric-upload.service";
import { logger } from "../shared/logger";

export async function processRubricJob(input: { activityId: string; activityType: string; filePath: string }) {
  const activities = new ActivityRepository();
  activities.updateRubric(input.activityId, { status: "processing", filePath: input.filePath, aiJson: null, error: null });

  try {
    const result = await new RubricUploadService().processFile({
      filePath: input.filePath,
      activityType: input.activityType,
    });
    activities.updateRubric(input.activityId, {
      status: "ready",
      filePath: result.filePath,
      extractedText: result.extractedText,
      aiJson: result.aiJson,
      error: result.aiJson ? null : "AI rubric generation skipped; extracted rubric text is used.",
    });
  } catch (error) {
    logger.error("Rubric processing failed", error);
    activities.updateRubric(input.activityId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Rubric processing failed",
    });
  }
}
