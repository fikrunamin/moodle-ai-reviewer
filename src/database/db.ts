import { Database } from "bun:sqlite";
import { paths } from "../runtime/paths";

let db: Database | null = null;

export function getDb() {
  db ??= new Database(paths.database, { create: true });
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
