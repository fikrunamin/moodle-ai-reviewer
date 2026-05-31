import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { ForumRepository } from "../database/repositories/forum.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { DiscussionReviewAgent } from "../ai/discussion-review.agent";

function clamp(value: unknown, max: number) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(max, score));
}

export async function generateDiscussionReviewJob(studentId: string) {
  const students = new StudentRepository();
  const assessments = new AssessmentRepository();
  const activities = new ActivityRepository();
  const forum = new ForumRepository();
  const student = students.find(studentId);
  if (!student) throw new Error("Student not found");
  const activity = activities.find(student.activity_id);
  if (!activity) throw new Error("Activity not found");

  const posts = forum.listPostsByStudent(studentId);
  const studentPosts = posts.filter((post) => post.author_role === "student");
  const tutorReplies = posts.filter((post) => post.author_role === "tutor");
  const ratingMax = posts.find((post) => post.rating_max)?.rating_max ?? 100;

  students.updateAiStatus(studentId, "processing");
  try {
    const result = await new DiscussionReviewAgent().review({
      courseContext: activity.course_context,
      rubricGuide: activity.rubric_ai_json ?? activity.rubric_extracted_text,
      prompt: activity.prompt ?? "",
      posts: studentPosts.map((post) => post.content).join("\n\n"),
      tutorReplies: tutorReplies.map((post) => post.content).join("\n\n"),
      interactionCount: student.interaction_count,
      ratingMax,
    });

    const scores = [
      { criteriaName: "Kesesuaian Jawaban", criteriaScore: clamp(result.scores?.instruction_alignment, 20), maxScore: 20 },
      { criteriaName: "Kedalaman Analisis", criteriaScore: clamp(result.scores?.analysis_depth, 25), maxScore: 25 },
      { criteriaName: "Keterkaitan Teori/Konsep", criteriaScore: clamp(result.scores?.conceptual_grounding, 20), maxScore: 20 },
      { criteriaName: "Relevansi Contoh/Argumen", criteriaScore: clamp(result.scores?.argument_relevance, 15), maxScore: 15 },
      { criteriaName: "Kualitas Referensi", criteriaScore: clamp(result.scores?.reference_quality, 10), maxScore: 10 },
      { criteriaName: "Etika dan Kejelasan", criteriaScore: clamp(result.scores?.communication_ethics, 10), maxScore: 10 },
    ];
    const fallbackScore = scores.reduce((sum, score) => sum + score.criteriaScore, 0);
    const recommendedScore = clamp(result.recommended_score ?? fallbackScore, ratingMax ?? 100);
    const assessment = assessments.create({
      activityId: activity.id,
      studentId,
      summary: String(result.summary ?? ""),
      feedback: String(result.feedback ?? ""),
      recommendedScore,
      manualReviewRequired: Boolean(result.manual_review_required || studentPosts.length === 0),
      manualReviewReason: result.manual_review_reason ?? (studentPosts.length === 0 ? "Tidak ada komentar mahasiswa yang bisa dianalisis." : null),
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
