import { JobQueue } from "./job-queue";

export const syncQueue = new JobQueue();
export const aiQueue = new JobQueue();
export const rubricQueue = new JobQueue();
export const enrichmentQueue = new JobQueue();
export const referenceQueue = new JobQueue();
