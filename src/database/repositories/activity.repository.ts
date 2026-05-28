import { nanoid } from "nanoid";
import { getDb } from "../db";
import type { ActivityType, MoodleActivity } from "../../shared/types";

export class ActivityRepository {
  list(): MoodleActivity[] {
    return getDb()
      .query("SELECT * FROM moodle_activities ORDER BY created_at DESC")
      .all() as MoodleActivity[];
  }

  create(input: { type: ActivityType; title: string; url: string }): MoodleActivity {
    const id = nanoid();
    getDb()
      .query("INSERT INTO moodle_activities (id, type, title, url) VALUES (?, ?, ?, ?)")
      .run(id, input.type, input.title, input.url);
    return getDb().query("SELECT * FROM moodle_activities WHERE id = ?").get(id) as MoodleActivity;
  }
}
