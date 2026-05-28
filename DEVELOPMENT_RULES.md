# Development Rules

## 1. Read Only Moodle

Never write to Moodle.

Forbidden actions:
- submit grade
- save feedback
- delete post
- edit activity
- change student data

## 2. Local First

All data is stored locally.

Use:
- SQLite
- data folder
- local sessions

## 3. Portable First

App must run from any folder.

Use:
- process.cwd()
- relative data path
- no hardcoded absolute path

## 4. Windows First

Primary target:
- Windows executable
- localhost:9876
- auto Chrome detection

## 5. AI Provider Flexible

Do not hardcode one AI provider.

Support:
- base_url
- api_key
- model_name

## 6. Graceful Failure

If something fails:
- log error
- update status
- show UI message
- do not crash whole app

## 7. Human Final Decision

AI output is recommendation only.

Always use:
- recommended_score
- draft_feedback
- manual_review_required

Never use:
- final_score
- final_grade

## 8. Bulk Job Safety

Bulk generate must:
- queue jobs
- avoid duplicate processing
- show progress
- allow retry
- keep partial results
