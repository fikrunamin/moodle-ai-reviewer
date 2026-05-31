import { ActivityRepository } from "../database/repositories/activity.repository";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { ForumReferenceRepository, ForumRepository } from "../database/repositories/forum.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { DiscussionReviewAgent } from "../ai/discussion-review.agent";

function summarizeReferences(refs: ReturnType<ForumReferenceRepository["listByStudent"]>) {
  return refs
    .map((ref) => {
      const relevance = ref.relevance_json ? `Analisis: ${ref.relevance_json}` : "Analisis: belum tersedia";
      return `- ${ref.raw_text}\n  Status: ${ref.resolve_status}${ref.resolve_source ? ` via ${ref.resolve_source}` : ""}\n  ${relevance}`;
    })
    .join("\n");
}

export async function generateForumReplySuggestionJob(studentId: string) {
  const students = new StudentRepository();
  const activities = new ActivityRepository();
  const assessments = new AssessmentRepository();
  const forum = new ForumRepository();
  const refs = new ForumReferenceRepository();
  const student = students.find(studentId);
  if (!student) throw new Error("Student not found");
  const activity = activities.find(student.activity_id);
  if (!activity) throw new Error("Activity not found");

  const posts = forum.listPostsByStudent(studentId);
  const studentPosts = posts.filter((post) => post.author_role === "student");
  const tutorReplies = posts.filter((post) => post.author_role === "tutor");
  const assessment = assessments.findByStudent(studentId);
  const references = refs.listByStudent(studentId);

  const result = await new DiscussionReviewAgent().suggestReply({
    courseContext: activity.course_context,
    prompt: activity.prompt ?? "",
    studentPosts: studentPosts.map((post) => post.content).join("\n\n"),
    tutorReplies: tutorReplies.map((post) => post.content).join("\n\n"),
    assessmentSummary: assessment ? `${assessment.summary}\n${assessment.feedback}` : null,
    referenceAnalysis: references.length ? summarizeReferences(references) : null,
  });

  return forum.saveReplySuggestion({
    activityId: activity.id,
    studentId,
    suggestion: String((result as { suggestion?: unknown }).suggestion ?? ""),
    rawJson: result,
  });
}
