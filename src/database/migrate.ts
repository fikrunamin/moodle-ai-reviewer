import { getDb } from "./db";
import { schemaSql } from "./schema";

function ensureColumn(table: string, column: string, definition: string) {
  const db = getDb();
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function migrate() {
  getDb().exec(schemaSql);
  ensureColumn("moodle_activities", "instruction", "TEXT");
  ensureColumn("moodle_activities", "prompt", "TEXT");
  ensureColumn("moodle_activities", "course_context", "TEXT");
  ensureColumn("moodle_activities", "rubric_file_path", "TEXT");
  ensureColumn("moodle_activities", "rubric_extracted_text", "TEXT");
  ensureColumn("moodle_activities", "rubric_ai_json", "TEXT");
  ensureColumn("moodle_activities", "rubric_status", "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn("moodle_activities", "rubric_error", "TEXT");
  ensureColumn("moodle_activities", "sync_error", "TEXT");
  ensureColumn("moodle_students", "interaction_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("ai_assessments", "is_obsolete", "INTEGER NOT NULL DEFAULT 0");
}
