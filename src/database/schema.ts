export const schemaSql = `
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  model_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moodle_activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'discussion')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  course_context TEXT,
  instruction TEXT,
  prompt TEXT,
  rubric_file_path TEXT,
  rubric_extracted_text TEXT,
  rubric_ai_json TEXT,
  rubric_status TEXT NOT NULL DEFAULT 'none',
  rubric_error TEXT,
  sync_status TEXT NOT NULL DEFAULT 'idle',
  sync_error TEXT,
  last_synced_at TEXT,
  total_students INTEGER NOT NULL DEFAULT 0,
  reviewed_students INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moodle_students (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  email TEXT,
  submission_status TEXT,
  ai_status TEXT NOT NULL DEFAULT 'pending',
  recommended_score REAL,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES moodle_activities(id)
);

CREATE TABLE IF NOT EXISTS moodle_submissions (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  submission_text TEXT,
  extracted_text TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES moodle_activities(id),
  FOREIGN KEY (student_id) REFERENCES moodle_students(id)
);

CREATE TABLE IF NOT EXISTS moodle_submission_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  file_path TEXT NOT NULL,
  extracted_text_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES moodle_submissions(id)
);

CREATE TABLE IF NOT EXISTS moodle_discussion_posts (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  student_id TEXT,
  content TEXT NOT NULL,
  reply_to TEXT,
  author_name TEXT NOT NULL,
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES moodle_activities(id),
  FOREIGN KEY (student_id) REFERENCES moodle_students(id)
);

CREATE TABLE IF NOT EXISTS ai_assessments (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  feedback TEXT NOT NULL,
  recommended_score REAL NOT NULL,
  manual_review_required INTEGER NOT NULL DEFAULT 0,
  manual_review_reason TEXT,
  is_obsolete INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES moodle_activities(id),
  FOREIGN KEY (student_id) REFERENCES moodle_students(id)
);

CREATE TABLE IF NOT EXISTS ai_assessment_scores (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  criteria_name TEXT NOT NULL,
  criteria_score REAL NOT NULL,
  max_score REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES ai_assessments(id)
);

CREATE TABLE IF NOT EXISTS pdf_summaries (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  bullet_points TEXT,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  error TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES moodle_submission_files(id)
);
CREATE INDEX IF NOT EXISTS idx_pdf_summaries_file ON pdf_summaries(file_id);

CREATE TABLE IF NOT EXISTS extracted_links (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  file_id TEXT,
  url TEXT NOT NULL,
  kind TEXT NOT NULL,
  youtube_video_id TEXT,
  youtube_title TEXT,
  youtube_author TEXT,
  youtube_thumbnail_url TEXT,
  oembed_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES moodle_submissions(id),
  FOREIGN KEY (file_id) REFERENCES moodle_submission_files(id)
);
CREATE INDEX IF NOT EXISTS idx_extracted_links_submission ON extracted_links(submission_id);

CREATE TABLE IF NOT EXISTS extracted_references (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  title TEXT,
  source TEXT,
  doi TEXT,
  url TEXT,
  arxiv_id TEXT,
  parse_status TEXT NOT NULL DEFAULT 'parsed',
  resolve_status TEXT NOT NULL DEFAULT 'pending',
  resolve_source TEXT,
  resolved_pdf_path TEXT,
  resolved_pdf_url TEXT,
  resolved_metadata_json TEXT,
  resolve_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES moodle_submissions(id)
);
CREATE INDEX IF NOT EXISTS idx_extracted_references_submission ON extracted_references(submission_id);

CREATE TABLE IF NOT EXISTS reference_resolutions (
  cache_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  pdf_path TEXT,
  pdf_url TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
