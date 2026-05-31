export type ActivityType = "assignment" | "discussion";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export type AiStatus = "pending" | "processing" | "completed" | "failed";

export interface MoodleActivity {
  id: string;
  type: ActivityType;
  title: string;
  url: string;
  course_context: string | null;
  instruction: string | null;
  instruction_files: string | null;
  instruction_doc_text: string | null;
  instruction_brief: string | null;
  prompt: string | null;
  rubric_file_path: string | null;
  rubric_extracted_text: string | null;
  rubric_ai_json: string | null;
  rubric_status: string;
  rubric_error: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
  total_students: number;
  reviewed_students: number;
  created_at: string;
  updated_at: string;
}

export interface InstructionFile {
  url: string;
  filename: string;
  kind: "pdf" | "docx" | "other";
}

export interface MoodleStudent {
  id: string;
  activity_id: string;
  student_name: string;
  email: string | null;
  submission_status: string | null;
  ai_status: AiStatus;
  recommended_score: number | null;
  interaction_count: number;
  created_at: string;
  updated_at: string;
}

export interface MoodleSubmission {
  id: string;
  activity_id: string;
  student_id: string;
  submission_text: string | null;
  extracted_text: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoodleSubmissionFile {
  id: string;
  submission_id: string;
  filename: string;
  mime_type: string | null;
  file_path: string;
  preview_pdf_path: string | null;
  extracted_text_path: string | null;
  created_at: string;
}

export interface MoodleDiscussionPost {
  id: string;
  activity_id: string;
  student_id: string | null;
  content: string;
  reply_to: string | null;
  author_name: string;
  posted_at: string | null;
  created_at: string;
}

export interface AiSetting {
  id: string;
  provider_name: string;
  base_url: string;
  api_key_encrypted: string | null;
  model_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AssessmentScore {
  id: string;
  assessment_id: string;
  criteria_name: string;
  criteria_score: number;
  max_score: number;
  created_at: string;
}

export interface AiAssessment {
  id: string;
  activity_id: string;
  student_id: string;
  summary: string;
  feedback: string;
  recommended_score: number;
  manual_review_required: boolean;
  manual_review_reason: string | null;
  is_obsolete: number;
  raw_json: unknown;
  created_at: string;
}

export type PdfSummaryStatus = "pending" | "processing" | "completed" | "failed";

export interface PdfSummary {
  id: string;
  file_id: string;
  summary: string;
  bullet_points: string | null;
  language: string | null;
  status: PdfSummaryStatus;
  error: string | null;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

export type ExtractedLinkKind = "youtube" | "doi" | "arxiv" | "generic";
export type OembedStatus = "ok" | "failed" | "skipped";

export interface ExtractedLink {
  id: string;
  submission_id: string;
  file_id: string | null;
  url: string;
  kind: ExtractedLinkKind;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_author: string | null;
  youtube_thumbnail_url: string | null;
  oembed_status: OembedStatus | null;
  created_at: string;
}

export type ReferenceParseStatus = "parsed" | "failed";
export type ReferenceResolveStatus = "pending" | "resolving" | "found" | "not_found" | "failed";
export type ReferenceResolveSource = "crossref" | "unpaywall" | "arxiv" | "cache" | "none";

export interface ExtractedReference {
  id: string;
  submission_id: string;
  raw_text: string;
  authors: string | null;
  year: number | null;
  title: string | null;
  source: string | null;
  doi: string | null;
  url: string | null;
  arxiv_id: string | null;
  parse_status: ReferenceParseStatus;
  resolve_status: ReferenceResolveStatus;
  resolve_source: ReferenceResolveSource | null;
  resolved_pdf_path: string | null;
  resolved_pdf_url: string | null;
  resolved_metadata_json: string | null;
  resolve_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferenceResolution {
  cache_key: string;
  source: ReferenceResolveSource;
  pdf_path: string | null;
  pdf_url: string | null;
  metadata_json: string;
  created_at: string;
}
