import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "./db";

export async function migrate() {
  const sql = await readFile(join(process.cwd(), "src", "database", "schema.sql"), "utf8");
  getDb().exec(sql);
}
