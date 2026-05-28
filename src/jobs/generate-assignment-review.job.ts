export async function generateAssignmentReviewJob(studentId: string) {
  return { studentId, status: "queued" };
}
