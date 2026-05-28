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
  sync_status TEXT NOT NULL DEFAULT 'idle',
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
