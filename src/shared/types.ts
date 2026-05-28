export type ActivityType = "assignment" | "discussion";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export type AiStatus = "pending" | "processing" | "completed" | "failed";

export interface MoodleActivity {
  id: string;
  type: ActivityType;
  title: string;
  url: string;
  sync_status: SyncStatus;
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
  created_at: string;
  updated_at: string;
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
  raw_json: unknown;
  created_at: string;
}
