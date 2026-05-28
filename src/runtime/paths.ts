import { join } from "node:path";

const root = process.cwd();

export const paths = {
  root,
  data: join(root, "data"),
  database: join(root, "data", "app.sqlite"),
  downloads: join(root, "data", "downloads"),
  extracted: join(root, "data", "extracted"),
  sessions: join(root, "data", "sessions"),
  logs: join(root, "data", "logs"),
  webDist: join(root, "web-dist"),
  sourceWebDist: join(root, "src", "web", "dist"),
};
