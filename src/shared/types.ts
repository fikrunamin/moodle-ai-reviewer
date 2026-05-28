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
  prompt: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
  total_students: number;
  reviewed_students: number;
  created_at: string;
  updated_at: string;
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
