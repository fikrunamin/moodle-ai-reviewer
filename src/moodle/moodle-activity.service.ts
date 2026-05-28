import { ActivityRepository } from "../database/repositories/activity.repository";
import type { ActivityType } from "../shared/types";

export class MoodleActivityService {
  private readonly activities = new ActivityRepository();

  listActivities() {
    return this.activities.list();
  }

  addActivity(input: {
    type: ActivityType;
    title?: string;
    url: string;
    rubricStatus?: string;
  }) {
    return this.activities.create(input);
  }
}
