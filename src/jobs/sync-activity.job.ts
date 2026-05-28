import { MoodleSyncService } from "../moodle/moodle-sync.service";

export async function syncActivityJob(activityId: string) {
  return new MoodleSyncService().syncActivity(activityId);
}
