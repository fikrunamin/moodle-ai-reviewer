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

export function AssessmentDetailPanel({ studentId, activityType }: { studentId: string | null; activityType: "assignment" | "discussion" | null }) {
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
    return <div className="win-window h-full"><div className="win-titlebar">Preview</div><p className="p-2">Pilih mahasiswa untuk melihat review.</p></div>;
  }

  const type = detail?.activity.type ?? activityType;

  return (
    <div className="win-window win-scroll flex h-full flex-col gap-2 overflow-y-auto">
      <div className="win-titlebar">
        <div>
          <h2 className="font-semibold">{detail?.student.student_name ?? "Assessment"}</h2>
          <p>{type ?? "No activity selected"}</p>
        </div>
        <button className="win-button" disabled={busy} onClick={generate}>
          {busy ? "⏳ Generating" : "✨ Generate"}
        </button>
      </div>
      <div className="grid gap-2 p-2">
      {generateStatus ? <p className="win-status">{generateStatus}</p> : null}
      {assessment?.is_obsolete ? (
        <p className="win-status">⚠️ Review AI ini obsolete karena data Moodle sudah disinkron ulang. Generate ulang untuk assessment terbaru.</p>
      ) : null}

      {type === "assignment" ? (
        <section className="grid gap-3">
          <h3 className="win-section-title">Assignment Evidence</h3>
          <div className="win-inset p-2">
            <p className="font-bold">Judul tugas</p>
            <p className="text-sm font-medium">{detail?.activity.title ?? "-"}</p>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Konteks mata kuliah</p>
            <p className="text-sm leading-6">{detail?.activity.course_context ?? "-"}</p>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Arahan tugas</p>
            <p className="max-h-48 overflow-auto text-sm leading-6">{detail?.activity.instruction ?? "-"}</p>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Rubrik</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5">
              {detail?.activity.rubric_ai_json || detail?.activity.rubric_extracted_text || "Rubrik default digunakan."}
            </pre>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Preview file/PDF</p>
            {detail?.files.length ? (
              <div className="grid gap-3">
                {detail.files.map((file) => (
                  <PdfFileCard key={file.id} fileId={file.id} filename={file.filename} />
                ))}
              </div>
            ) : (
              <p>Belum ada file PDF.</p>
            )}
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Extracted text</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5">{detail?.submission?.extracted_text || detail?.submission?.submission_text || "Belum ada teks submission."}</pre>
          </div>
          {submissionId ? (
            <div className="win-inset p-2">
              <LinksSection submissionId={submissionId} />
            </div>
          ) : null}
          {submissionId ? (
            <div className="win-inset p-2">
              <ReferencesSection submissionId={submissionId} />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-3">
          <h3 className="win-section-title">Discussion Evidence</h3>
          <div className="win-inset p-2">
            <p className="font-bold">Thread title</p>
            <p className="text-sm">{detail?.activity.title ?? "-"}</p>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Prompt diskusi</p>
            <p className="text-sm leading-6">{detail?.activity.prompt ?? "-"}</p>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Komentar dan reply mahasiswa · {detail?.student.interaction_count ?? 0} interactions</p>
            <div className="grid max-h-52 gap-2 overflow-auto">
              {detail?.posts.length ? detail.posts.map((post, index) => <p className="win-status text-sm leading-6" key={index}>{post.content}</p>) : <p>Belum ada komentar.</p>}
            </div>
          </div>
        </section>
      )}

      {!assessment ? (
        <p className="win-status">Belum ada assessment.</p>
      ) : (
        <section className="grid gap-3">
          <div className="flex items-end justify-between border-b border-slate-200 pb-3">
            <span className="text-sm font-medium">Recommended score</span>
            <strong className="text-4xl tabular-nums">{assessment.recommended_score}</strong>
          </div>
          <div className="win-inset p-2">
            <p className="font-bold">Summary</p>
            <p className="text-sm leading-6">{assessment.summary}</p>
          </div>
          {assessment.manual_review_required ? (
            <p className="win-status">⚠️ {assessment.manual_review_reason ?? "Perlu review manual."}</p>
          ) : null}
          <div className="grid gap-2">
            {(assessment.scores ?? []).map((score) => (
              <RubricScore key={score.criteria_name} label={score.criteria_name} score={score.criteria_score} maxScore={score.max_score} />
            ))}
          </div>
          <CopyFeedbackBox feedback={assessment.feedback} />
        </section>
      )}
      </div>
    </div>
  );
}
