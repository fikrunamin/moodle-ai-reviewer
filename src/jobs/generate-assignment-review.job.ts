import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { AssignmentReviewAgent } from "../ai/assignment-review.agent";

interface RubricCriterion {
  name: string;
  max_score: number;
  description: string | null;
}

const defaultScores = [
  { criteriaName: "Kesesuaian Instruksi", criteriaScore: 0, maxScore: 20, legacyKey: "instruction_match" },
  { criteriaName: "Kreativitas Ide", criteriaScore: 0, maxScore: 20, legacyKey: "creativity" },
  { criteriaName: "Teknik dan Bahan", criteriaScore: 0, maxScore: 20, legacyKey: "technique_material" },
  { criteriaName: "Kualitas Hasil Akhir", criteriaScore: 0, maxScore: 20, legacyKey: "final_quality" },
  { criteriaName: "Dokumentasi Proses", criteriaScore: 0, maxScore: 10, legacyKey: "documentation" },
  { criteriaName: "Refleksi Mahasiswa", criteriaScore: 0, maxScore: 10, legacyKey: "reflection" },
];

function safeJson(value: string | null | undefined): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractRubricCriteria(rubricJson: string | null | undefined): RubricCriterion[] {
  const parsed = safeJson(rubricJson);
  if (!parsed || typeof parsed !== "object") return [];
  const criteria = (parsed as { criteria?: unknown }).criteria;
  if (!Array.isArray(criteria)) return [];
  return criteria
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { name?: unknown; max_score?: unknown; maxScore?: unknown; description?: unknown };
      const name = String(row.name ?? "").trim();
      const maxScore = Number(row.max_score ?? row.maxScore ?? 0);
      if (!name || !Number.isFinite(maxScore) || maxScore <= 0) return null;
      return {
        name,
        max_score: maxScore,
        description: row.description ? String(row.description) : null,
      };
    })
    .filter((item): item is RubricCriterion => Boolean(item));
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function clampScore(value: unknown, maxScore: number) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(maxScore, score));
}

function scoresFromDynamicRubric(result: any, rubricCriteria: RubricCriterion[]) {
  const criteriaScores = Array.isArray(result?.criteria_scores)
    ? (result.criteria_scores.filter((item: unknown) => item && typeof item === "object") as Array<Record<string, unknown>>)
    : [];
  const byName = new Map(criteriaScores.map((score) => [normalizeName(String(score.criteria_name ?? score.name ?? "")), score]));

  return rubricCriteria.map((criterion) => {
    const matched = byName.get(normalizeName(criterion.name));
    return {
      criteriaName: criterion.name,
      criteriaScore: clampScore(matched?.criteria_score ?? matched?.score, criterion.max_score),
      maxScore: criterion.max_score,
    };
  });
}

function scoresFromDefault(result: any) {
  return defaultScores.map((score) => ({
    criteriaName: score.criteriaName,
    criteriaScore: clampScore(result?.scores?.[score.legacyKey], score.maxScore),
    maxScore: score.maxScore,
  }));
}

export async function generateAssignmentReviewJob(studentId: string) {
  const students = new StudentRepository();
  const submissions = new SubmissionRepository();
  const assessments = new AssessmentRepository();
  const activities = new ActivityRepository();
  const student = students.find(studentId);
  if (!student) throw new Error("Student not found");
  const activity = activities.find(student.activity_id);
  if (!activity) throw new Error("Activity not found");
  const submission = submissions.findByStudent(studentId);

  students.updateAiStatus(studentId, "processing");
  try {
    const missingPdf = !submission?.extracted_text;
    const rubricCriteria = extractRubricCriteria(activity.rubric_ai_json);
    const result = await new AssignmentReviewAgent().review({
      courseContext: activity.course_context,
      instruction: activity.instruction ?? "",
      rubricGuide: activity.rubric_ai_json ?? activity.rubric_extracted_text,
      rubricCriteria,
      submissionText: submission?.submission_text ?? "",
      extractedText: submission?.extracted_text ?? "",
    });

    const scores = rubricCriteria.length ? scoresFromDynamicRubric(result, rubricCriteria) : scoresFromDefault(result);
    const scoreSum = scores.reduce((sum, score) => sum + score.criteriaScore, 0);
    const recommendedScore = Number.isFinite(Number(result.recommended_score)) ? Number(result.recommended_score) : scoreSum;
    const assessment = assessments.create({
      activityId: activity.id,
      studentId,
      summary: String(result.summary ?? ""),
      feedback: String(result.feedback ?? ""),
      recommendedScore,
      manualReviewRequired: Boolean(result.manual_review_required || missingPdf),
      manualReviewReason: result.manual_review_reason ?? (missingPdf ? "PDF tidak tersedia atau belum berhasil diekstrak." : null),
      rawJson: result,
      scores,
    });
    students.updateAiStatus(studentId, "completed", recommendedScore);
    activities.refreshCounts(activity.id);
    return assessment;
  } catch (error) {
    students.updateAiStatus(studentId, "failed");
    throw error;
  }
}
