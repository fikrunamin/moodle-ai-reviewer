import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { ExtractedLinkRepository } from "../database/repositories/extracted-link.repository";
import { ReferenceRepository } from "../database/repositories/reference.repository";
import { SubmissionRepository } from "../database/repositories/submission.repository";
import { extractLinksFromSources } from "../pdf/link-extractor";
import { parseReferencesFromText } from "../pdf/reference-extractor";
import {
  buildEmbedUrl,
  extractYoutubeVideoId,
  fetchYoutubeOembed,
} from "../pdf/youtube";
import { logger } from "../shared/logger";
import { referenceQueue } from "./queues";
import { resolveReferenceJob } from "./resolve-reference.job";

async function readFileTextSafe(path: string | null) {
  if (!path) return "";
  if (!existsSync(path)) return "";
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function extractPdfEnrichmentsJob(input: {
  submissionId: string;
  parseReferences?: boolean;
}) {
  const submissions = new SubmissionRepository();
  const links = new ExtractedLinkRepository();
  const refs = new ReferenceRepository();

  const submission = submissions.find(input.submissionId);
  if (!submission) return;

  const files = submissions.listFiles(submission.id);
  const sources: Array<{ text: string; fileId?: string | null }> = [];
  if (submission.submission_text) {
    sources.push({ text: submission.submission_text });
  }
  if (submission.extracted_text) {
    sources.push({ text: submission.extracted_text });
  }
  for (const file of files) {
    if (!file.extracted_text_path) continue;
    const content = await readFileTextSafe(file.extracted_text_path);
    if (content.trim()) sources.push({ text: content, fileId: file.id });
  }

  // Step 1: link extraction
  const candidates = extractLinksFromSources(sources);
  links.replaceForSubmission(
    submission.id,
    candidates.map((candidate) => {
      const youtubeId = candidate.kind === "youtube" ? extractYoutubeVideoId(candidate.url) : null;
      return {
        url: candidate.url,
        kind: candidate.kind,
        fileId: candidate.fileId ?? null,
        youtubeVideoId: youtubeId,
        oembedStatus: null,
      };
    }),
  );

  // Step 2: enrich YouTube links via oEmbed
  const stored = links.listBySubmission(submission.id);
  const youtubeLinks = stored.filter((link) => link.kind === "youtube");
  const concurrency = Math.max(1, Number(process.env.YOUTUBE_OEMBED_CONCURRENCY ?? 4));
  let cursor = 0;
  async function worker() {
    while (cursor < youtubeLinks.length) {
      const idx = cursor++;
      const link = youtubeLinks[idx]!;
      try {
        const oembed = await fetchYoutubeOembed(link.url);
        links.updateYoutubeMeta(link.id, {
          youtubeTitle: oembed.title ?? null,
          youtubeAuthor: oembed.authorName ?? null,
          youtubeThumbnailUrl: oembed.thumbnailUrl ?? null,
          oembedStatus: oembed.ok ? "ok" : "failed",
        });
      } catch (error) {
        logger.error("Enrich YouTube link failed", error);
        links.updateYoutubeMeta(link.id, { oembedStatus: "failed" });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Step 3: references
  if (input.parseReferences ?? true) {
    const text = sources.map((source) => source.text).join("\n\n");
    try {
      const parsed = await parseReferencesFromText(text);
      refs.replaceForSubmission(submission.id, parsed.references);
      const pending = refs.listPending(submission.id);
      for (const reference of pending) {
        referenceQueue.enqueue(() => resolveReferenceJob(reference.id));
      }
    } catch (error) {
      logger.error("Parse references failed", error);
    }
  }

  // Build embed urls (kept here for future cache columns; consumers compute on the fly via util)
  void buildEmbedUrl;
}
