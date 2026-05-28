import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "./db";

function ensureColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function migrate() {
  const sql = await readFile(join(process.cwd(), "src", "database", "schema.sql"), "utf8");
  getDb().exec(sql);
  ensureColumn("moodle_activities", "instruction", "TEXT");
  ensureColumn("moodle_activities", "prompt", "TEXT");
  ensureColumn("moodle_activities", "course_context", "TEXT");
  ensureColumn("moodle_activities", "sync_error", "TEXT");
  ensureColumn("moodle_students", "interaction_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("ai_assessments", "is_obsolete", "INTEGER NOT NULL DEFAULT 0");
}
