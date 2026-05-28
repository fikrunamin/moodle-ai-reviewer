export async function syncActivityJob(activityId: string) {
  return { activityId, status: "queued" };
}
