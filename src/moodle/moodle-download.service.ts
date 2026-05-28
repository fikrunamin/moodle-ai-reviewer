import { join } from "node:path";
import { paths } from "../runtime/paths";

export class MoodleDownloadService {
  getSafeDownloadPath(activityId: string, studentId: string, filename: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(paths.downloads, `${activityId}_${studentId}_${safeName}`);
  }
}
