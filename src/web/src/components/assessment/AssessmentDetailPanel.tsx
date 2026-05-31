import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { CopyFeedbackBox } from "./CopyFeedbackBox";
import { RubricScore } from "./RubricScore";
import { PdfFileCard } from "./pdf/PdfFileCard";
import { LinksSection } from "./links/LinksSection";
import { ReferencesSection } from "./references/ReferencesSection";

interface Assessment {
  summary: string;
  feedback: string;
  recommended_score: number;
  manual_review_required: number;
  manual_review_reason: string | null;
  is_obsolete: number;
  scores?: Array<{ criteria_name: string; criteria_score: number; max_score: number }>;
}

interface Detail {
  student: { student_name: string; interaction_count: number };
  activity: {
    type: "assignment" | "discussion";
    title: string;
    course_context: string | null;
    instruction: string | null;
    prompt: string | null;
    rubric_file_path: string | null;
    rubric_ai_json: string | null;
    rubric_extracted_text: string | null;
  };
  submission: { id?: string; submission_text: string | null; extracted_text: string | null } | null;
  files: Array<{ id: string; filename: string; file_path: string; extracted_text_path: string | null }>;
  posts: Array<{ content: string; reply_to: string | null }>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="win-section-title">{label}</span>
      <div className="win-inset px-3 py-2 text-[12.5px] leading-relaxed text-secondary">{children}</div>
    </div>
  );
}

export function AssessmentDetailPanel({
  studentId,
  activityType,
}: {
  studentId: string | null;
  activityType: "assignment" | "discussion" | null;
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string | null>(null);

  const refresh = () => {
    if (!studentId) {
      setAssessment(null);
      setDetail(null);
      return;
    }
    apiGet<Assessment | null>(`/api/students/${studentId}/assessment`)
      .then(setAssessment)
      .catch(() => setAssessment(null));
    apiGet<Detail | null>(`/api/students/${studentId}/detail`)
      .then(setDetail)
      .catch(() => setDetail(null));
  };

  useEffect(() => {
    refresh();
  }, [studentId]);

  const submissionId = detail?.submission?.id ?? null;

  async function generate() {
    if (!studentId) return;
    setBusy(true);
    setGenerateStatus("Generating review...");
    try {
      await apiPost(`/api/students/${studentId}/generate`);
      setGenerateStatus("Review generated");
      refresh();
    } catch (error) {
      setGenerateStatus(error instanceof Error ? error.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  if (!studentId) {
    return (
      <div className="win-window flex h-full flex-col">
        <div className="win-titlebar">Preview</div>
        <p className="m-3 text-secondary">Pilih mahasiswa untuk melihat review.</p>
      </div>
    );
  }

  const type = detail?.activity.type ?? activityType;

  return (
    <div className="win-window win-scroll flex h-full flex-col overflow-y-auto">
      <div className="win-titlebar sticky top-0 z-10">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold">{detail?.student.student_name ?? "Assessment"}</h2>
          <p className="truncate text-[11px] text-muted">{type ?? "No activity selected"}</p>
        </div>
        <button className="win-button win-button-primary" disabled={busy} onClick={generate}>
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
      <div className="grid gap-3 p-3">
        {generateStatus ? <p className="win-status">{generateStatus}</p> : null}
        {assessment?.is_obsolete ? (
          <p className="win-status text-warn">
            Review AI obsolete karena data Moodle disinkron ulang. Generate ulang untuk hasil terbaru.
          </p>
        ) : null}

        {type === "assignment" ? (
          <section className="grid gap-3">
            <h3 className="win-section-title">Evidence</h3>
            <Field label="Judul tugas">{detail?.activity.title ?? "-"}</Field>
            <Field label="Konteks mata kuliah">{detail?.activity.course_context ?? "-"}</Field>
            <Field label="Arahan tugas">
              <p className="max-h-48 overflow-auto whitespace-pre-wrap">{detail?.activity.instruction ?? "-"}</p>
            </Field>
            <Field label="Rubrik">
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11.5px]">
                {detail?.activity.rubric_ai_json || detail?.activity.rubric_extracted_text || "Rubrik default digunakan."}
              </pre>
            </Field>

            <div className="grid gap-2">
              <span className="win-section-title">File PDF</span>
              {detail?.files.length ? (
                <div className="grid gap-3">
                  {detail.files.map((file) => (
                    <PdfFileCard key={file.id} fileId={file.id} filename={file.filename} />
                  ))}
                </div>
              ) : (
                <p className="win-status text-muted">Belum ada file PDF.</p>
              )}
            </div>

            <Field label="Extracted text">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[11.5px]">
                {detail?.submission?.extracted_text || detail?.submission?.submission_text || "Belum ada teks submission."}
              </pre>
            </Field>

            {submissionId ? <LinksSection submissionId={submissionId} /> : null}
            {submissionId ? <ReferencesSection submissionId={submissionId} /> : null}
          </section>
        ) : (
          <section className="grid gap-3">
            <h3 className="win-section-title">Discussion</h3>
            <Field label="Thread title">{detail?.activity.title ?? "-"}</Field>
            <Field label="Prompt diskusi">{detail?.activity.prompt ?? "-"}</Field>
            <div className="grid gap-1">
              <span className="win-section-title">
                Komentar mahasiswa · {detail?.student.interaction_count ?? 0} interaksi
              </span>
              <div className="grid max-h-60 gap-2 overflow-auto">
                {detail?.posts.length ? (
                  detail.posts.map((post, index) => (
                    <p className="win-inset px-3 py-2 text-[12.5px] leading-relaxed" key={index}>
                      {post.content}
                    </p>
                  ))
                ) : (
                  <p className="win-status text-muted">Belum ada komentar.</p>
                )}
              </div>
            </div>
          </section>
        )}

        <hr />

        {!assessment ? (
          <p className="win-status text-muted">Belum ada assessment.</p>
        ) : (
          <section className="grid gap-3">
            <div className="flex items-end justify-between divider border-b pb-3">
              <span className="win-section-title m-0">Recommended score</span>
              <strong className="text-3xl font-semibold tabular-nums">{assessment.recommended_score}</strong>
            </div>
            <Field label="Summary">{assessment.summary}</Field>
            {assessment.manual_review_required ? (
              <p className="win-status text-warn">
                {assessment.manual_review_reason ?? "Perlu review manual."}
              </p>
            ) : null}
            <div className="grid gap-1">
              <span className="win-section-title">Rubric breakdown</span>
              <div className="grid gap-1">
                {(assessment.scores ?? []).map((score) => (
                  <RubricScore
                    key={score.criteria_name}
                    label={score.criteria_name}
                    score={score.criteria_score}
                    maxScore={score.max_score}
                  />
                ))}
              </div>
            </div>
            <CopyFeedbackBox feedback={assessment.feedback} />
          </section>
        )}
      </div>
    </div>
  );
}
