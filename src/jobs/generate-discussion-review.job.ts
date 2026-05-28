import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { DiscussionReviewAgent } from "../ai/discussion-review.agent";
import { getDb } from "../database/db";

export async function generateDiscussionReviewJob(studentId: string) {
  const students = new StudentRepository();
  const assessments = new AssessmentRepository();
  const activities = new ActivityRepository();
  const student = students.find(studentId);
  if (!student) throw new Error("Student not found");
  const activity = activities.find(student.activity_id);
  if (!activity) throw new Error("Activity not found");

  const posts = getDb()
    .query("SELECT content FROM moodle_discussion_posts WHERE student_id = ? ORDER BY created_at ASC")
    .all(studentId) as Array<{ content: string }>;

  students.updateAiStatus(studentId, "processing");
  try {
    const result = await new DiscussionReviewAgent().review({
      courseContext: activity.course_context,
      rubricGuide: activity.rubric_ai_json ?? activity.rubric_extracted_text,
      prompt: activity.prompt ?? "",
      posts: posts.map((post) => post.content).join("\n\n"),
      interactionCount: student.interaction_count,
    });

    const scores = [
      { criteriaName: "Kualitas Argumen", criteriaScore: Number(result.scores?.argument_quality ?? 0), maxScore: 25 },
      { criteriaName: "Relevansi", criteriaScore: Number(result.scores?.relevance ?? 0), maxScore: 25 },
      { criteriaName: "Kedalaman Analisis", criteriaScore: Number(result.scores?.analysis_depth ?? 0), maxScore: 20 },
      { criteriaName: "Jumlah Interaksi", criteriaScore: Number(result.scores?.interaction_quantity ?? 0), maxScore: 20 },
      { criteriaName: "Etika Komunikasi", criteriaScore: Number(result.scores?.communication_ethics ?? 0), maxScore: 10 },
    ];
    const recommendedScore = Number(result.recommended_score ?? scores.reduce((sum, score) => sum + score.criteriaScore, 0));
    const assessment = assessments.create({
      activityId: activity.id,
      studentId,
      summary: String(result.summary ?? ""),
      feedback: String(result.feedback ?? ""),
      recommendedScore,
      manualReviewRequired: Boolean(result.manual_review_required || posts.length === 0),
      manualReviewReason: result.manual_review_reason ?? (posts.length === 0 ? "Tidak ada komentar mahasiswa yang bisa dianalisis." : null),
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
