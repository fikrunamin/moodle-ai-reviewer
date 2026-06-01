import type { Hono } from "hono";
import { AssessmentRepository } from "../database/repositories/assessment.repository";
import { ActivityRepository } from "../database/repositories/activity.repository";
import { ForumReferenceRepository, ForumRepository } from "../database/repositories/forum.repository";
import { StudentRepository } from "../database/repositories/student.repository";
import { enrichmentQueue, referenceQueue } from "../jobs/queues";
import { analyzeForumReferenceRelevanceJob } from "../jobs/analyze-forum-reference-relevance.job";
import { extractForumReferencesJob } from "../jobs/extract-forum-references.job";
import { generateDiscussionReviewJob } from "../jobs/generate-discussion-review.job";
import { generateForumReplySuggestionJob } from "../jobs/generate-forum-reply-suggestion.job";
import { resolveForumReferenceJob } from "../jobs/resolve-forum-reference.job";
import { validateForumReferenceJob } from "../jobs/validate-forum-reference.job";
import type { ForumReference, ForumReplySuggestion } from "../shared/types";

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeForumReference(reference: ForumReference) {
  return {
    ...reference,
    authors: parseJson(reference.authors) ?? null,
    resolved_metadata: parseJson(reference.resolved_metadata_json) ?? null,
    relevance: parseJson(reference.relevance_json) ?? null,
    validation: parseJson(reference.validation_json) ?? null,
  };
}

function serializeSuggestion(suggestion: ForumReplySuggestion | null) {
  if (!suggestion) return null;
  return { ...suggestion, raw_json: parseJson(suggestion.raw_json) };
}

export function registerForumRoutes(app: Hono) {
  app.get("/api/students/:studentId/forum-thread", (c) => {
    const studentId = c.req.param("studentId");
    const student = new StudentRepository().find(studentId);
    if (!student) return c.json(null, 404);
    const activity = new ActivityRepository().find(student.activity_id);
    const forum = new ForumRepository();
    const assessmentRepo = new AssessmentRepository();
    const assessment = assessmentRepo.findByStudent(studentId);
    return c.json({
      student,
      activity,
      firstPost: activity ? forum.firstPost(activity.id) : null,
      posts: forum.listPostsByStudent(studentId),
      suggestion: serializeSuggestion(forum.latestReplySuggestion(studentId)),
      assessment: assessment ? { ...assessment, scores: assessmentRepo.listScores(assessment.id) } : null,
    });
  });

  app.post("/api/forum/students/:studentId/review", async (c) => {
    const assessment = await generateDiscussionReviewJob(c.req.param("studentId"));
    return c.json(assessment);
  });

  app.post("/api/forum/students/:studentId/reply-suggestion", async (c) => {
    const suggestion = await generateForumReplySuggestionJob(c.req.param("studentId"));
    return c.json(serializeSuggestion(suggestion));
  });

  app.get("/api/forum/students/:studentId/references", (c) => {
    const refs = new ForumReferenceRepository().listByStudent(c.req.param("studentId"));
    return c.json(refs.map(serializeForumReference));
  });

  app.post("/api/forum/students/:studentId/references/refresh", (c) => {
    const studentId = c.req.param("studentId");
    enrichmentQueue.enqueue(async () => {
      await extractForumReferencesJob(studentId);
    });
    return c.json({ queued: true, queue: enrichmentQueue.getStatus() });
  });

  app.post("/api/forum/references/:refId/resolve", (c) => {
    const refId = c.req.param("refId");
    referenceQueue.enqueue(() => resolveForumReferenceJob(refId));
    return c.json({ queued: true, queue: referenceQueue.getStatus() });
  });

  app.post("/api/forum/references/:refId/analyze", (c) => {
    const refId = c.req.param("refId");
    referenceQueue.enqueue(async () => {
      await analyzeForumReferenceRelevanceJob(refId);
    });
    return c.json({ queued: true, queue: referenceQueue.getStatus() });
  });

  app.post("/api/forum/references/:refId/validate", (c) => {
    const refId = c.req.param("refId");
    referenceQueue.enqueue(async () => {
      await validateForumReferenceJob(refId);
    });
    return c.json({ queued: true, queue: referenceQueue.getStatus() });
  });
}
