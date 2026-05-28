export async function generateDiscussionReviewJob(studentId: string) {
  return { studentId, status: "queued" };
}
