import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { AssignmentReviewAgent } from "../ai/assignment-review.agent";

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
    const result = await new AssignmentReviewAgent().review({
      courseContext: activity.course_context,
      instruction: activity.instruction ?? "",
      submissionText: submission?.submission_text ?? "",
      extractedText: submission?.extracted_text ?? "",
    });

    const scores = [
      { criteriaName: "Kesesuaian Instruksi", criteriaScore: Number(result.scores?.instruction_match ?? 0), maxScore: 20 },
      { criteriaName: "Kreativitas Ide", criteriaScore: Number(result.scores?.creativity ?? 0), maxScore: 20 },
      { criteriaName: "Teknik dan Bahan", criteriaScore: Number(result.scores?.technique_material ?? 0), maxScore: 20 },
      { criteriaName: "Kualitas Hasil Akhir", criteriaScore: Number(result.scores?.final_quality ?? 0), maxScore: 20 },
      { criteriaName: "Dokumentasi Proses", criteriaScore: Number(result.scores?.documentation ?? 0), maxScore: 10 },
      { criteriaName: "Refleksi Mahasiswa", criteriaScore: Number(result.scores?.reflection ?? 0), maxScore: 10 },
    ];
    const recommendedScore = Number(result.recommended_score ?? scores.reduce((sum, score) => sum + score.criteriaScore, 0));
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
