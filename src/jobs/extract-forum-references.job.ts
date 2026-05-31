import { ForumReferenceRepository, ForumRepository } from "../database/repositories/forum.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { parseReferencesFromText } from "../pdf/reference-extractor";
import { logger } from "../shared/logger";
import { referenceQueue } from "./queues";
import { resolveForumReferenceJob } from "./resolve-forum-reference.job";

export async function extractForumReferencesJob(studentId: string) {
  const students = new StudentRepository();
  const forum = new ForumRepository();
  const refs = new ForumReferenceRepository();
  const student = students.find(studentId);
  if (!student) throw new Error("Student not found");

  const posts = forum.listStudentAuthoredPosts(studentId);
  const text = posts
    .map((post) => `### ${post.subject ?? post.moodle_post_id ?? "Post"}\n${post.content}`)
    .join("\n\n");
  if (!text.trim()) {
    refs.replaceForStudent({ activityId: student.activity_id, studentId, references: [] });
    return [];
  }

  try {
    const parsed = await parseReferencesFromText(text);
    refs.replaceForStudent({
      activityId: student.activity_id,
      studentId,
      postId: posts[0]?.id ?? null,
      references: parsed.references,
    });
    const stored = refs.listByStudent(studentId);
    for (const reference of stored) {
      referenceQueue.enqueue(() => resolveForumReferenceJob(reference.id));
    }
    return stored;
  } catch (error) {
    logger.error("Parse forum references failed", error);
    throw error;
  }
}
