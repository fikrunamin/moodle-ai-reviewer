import { getDb } from "../db";
import { nanoid } from "nanoid";
import type { AiAssessment, AssessmentScore } from "../../shared/types";

export class AssessmentRepository {
  findByStudent(studentId: string) {
    return getDb()
      .query("SELECT * FROM ai_assessments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(studentId) as AiAssessment | null;
  }

  listScores(assessmentId: string) {
    return getDb()
      .query("SELECT * FROM ai_assessment_scores WHERE assessment_id = ? ORDER BY created_at ASC")
      .all(assessmentId) as AssessmentScore[];
  }

  markActivityObsolete(activityId: string) {
    getDb().query("UPDATE ai_assessments SET is_obsolete = 1 WHERE activity_id = ?").run(activityId);
  }

  create(input: {
    activityId: string;
    studentId: string;
    summary: string;
    feedback: string;
    recommendedScore: number;
    manualReviewRequired: boolean;
    manualReviewReason?: string | null;
    rawJson: unknown;
    scores: Array<{ criteriaName: string; criteriaScore: number; maxScore: number }>;
  }) {
    const db = getDb();
    const id = nanoid();
    const tx = db.transaction(() => {
      db.query(
        "INSERT INTO ai_assessments (id, activity_id, student_id, summary, feedback, recommended_score, manual_review_required, manual_review_reason, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        input.activityId,
        input.studentId,
        input.summary,
        input.feedback,
        input.recommendedScore,
        input.manualReviewRequired ? 1 : 0,
        input.manualReviewReason ?? null,
        JSON.stringify(input.rawJson),
      );

      const insertScore = db.query(
        "INSERT INTO ai_assessment_scores (id, assessment_id, criteria_name, criteria_score, max_score) VALUES (?, ?, ?, ?, ?)",
      );
      for (const score of input.scores) {
        insertScore.run(nanoid(), id, score.criteriaName, score.criteriaScore, score.maxScore);
      }
    });
    tx();
    return this.findByStudent(input.studentId)!;
  }
}
