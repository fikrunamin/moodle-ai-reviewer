# Database Schema

## ai_settings

Menyimpan konfigurasi AI provider.

Fields:
- id
- provider_name
- base_url
- api_key_encrypted
- model_name
- is_active
- created_at
- updated_at

## moodle_activities

Fields:
- id
- type
- title
- url
- sync_status
- last_synced_at
- total_students
- reviewed_students
- created_at
- updated_at

## moodle_students

Fields:
- id
- activity_id
- student_name
- email
- submission_status
- ai_status
- recommended_score
- created_at
- updated_at

## moodle_submissions

Fields:
- id
- activity_id
- student_id
- submission_text
- extracted_text
- submitted_at
- created_at
- updated_at

## moodle_submission_files

Fields:
- id
- submission_id
- filename
- mime_type
- file_path
- extracted_text_path
- created_at

## moodle_discussion_posts

Fields:
- id
- activity_id
- student_id
- content
- reply_to
- author_name
- posted_at
- created_at

## ai_assessments

Fields:
- id
- activity_id
- student_id
- summary
- feedback
- recommended_score
- manual_review_required
- manual_review_reason
- raw_json
- created_at

## ai_assessment_scores

Fields:
- id
- assessment_id
- criteria_name
- criteria_score
- max_score
- created_at
