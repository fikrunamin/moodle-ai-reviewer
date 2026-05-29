import { nanoid } from "nanoid";
import { getDb } from "../db";
import type { PdfSummary, PdfSummaryStatus } from "../../shared/types";

export class PdfSummaryRepository {
  findByFile(fileId: string): PdfSummary | null {
    return (
      (getDb()
        .query("SELECT * FROM pdf_summaries WHERE file_id = ?")
        .get(fileId) as PdfSummary | null) ?? null
    );
  }

  setStatus(fileId: string, status: PdfSummaryStatus, error: string | null = null) {
    const db = getDb();
    const existing = this.findByFile(fileId);
    if (existing) {
      db.query(
        "UPDATE pdf_summaries SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?",
      ).run(status, error, fileId);
      return;
    }
    db.query(
      "INSERT INTO pdf_summaries (id, file_id, summary, status, error) VALUES (?, ?, ?, ?, ?)",
    ).run(nanoid(), fileId, "", status, error);
  }

  upsertCompleted(input: {
    fileId: string;
    summary: string;
    bulletPoints: string[];
    language: string | null;
    rawJson: unknown;
  }) {
    const db = getDb();
    const existing = this.findByFile(input.fileId);
    if (existing) {
      db.query(
        "UPDATE pdf_summaries SET summary = ?, bullet_points = ?, language = ?, status = 'completed', error = NULL, raw_json = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?",
      ).run(
        input.summary,
        JSON.stringify(input.bulletPoints),
        input.language,
        JSON.stringify(input.rawJson),
        input.fileId,
      );
    } else {
      db.query(
        "INSERT INTO pdf_summaries (id, file_id, summary, bullet_points, language, status, raw_json) VALUES (?, ?, ?, ?, ?, 'completed', ?)",
      ).run(
        nanoid(),
        input.fileId,
        input.summary,
        JSON.stringify(input.bulletPoints),
        input.language,
        JSON.stringify(input.rawJson),
      );
    }
    return this.findByFile(input.fileId)!;
  }
}
