import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { CopyFeedbackBox } from "./CopyFeedbackBox";
import { RubricScore } from "./RubricScore";
import { Wand2 } from "lucide-react";

interface Assessment {
  summary: string;
  feedback: string;
  recommended_score: number;
  manual_review_required: number;
  manual_review_reason: string | null;
  scores?: Array<{ criteria_name: string; criteria_score: number; max_score: number }>;
}

interface Detail {
  student: { student_name: string; interaction_count: number };
  activity: { type: "assignment" | "discussion"; title: string; instruction: string | null; prompt: string | null };
  submission: { submission_text: string | null; extracted_text: string | null } | null;
  files: Array<{ filename: string; file_path: string; extracted_text_path: string | null }>;
  posts: Array<{ content: string; reply_to: string | null }>;
}

export function AssessmentDetailPanel({ studentId, activityType }: { studentId: string | null; activityType: "assignment" | "discussion" | null }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function generate() {
    if (!studentId) return;
    setBusy(true);
    try {
      await apiPost(`/api/students/${studentId}/generate`);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!studentId) {
    return <p className="p-4 text-sm text-slate-500">Pilih mahasiswa untuk melihat review.</p>;
  }

  const type = detail?.activity.type ?? activityType;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{detail?.student.student_name ?? "Assessment"}</h2>
          <p className="text-xs text-slate-500">{type ?? "No activity selected"}</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={generate}>
          <Wand2 size={16} /> Generate
        </button>
      </div>

      {type === "assignment" ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Assignment Evidence</h3>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Preview file/PDF</p>
            {detail?.files.length ? detail.files.map((file) => <p className="text-sm" key={file.file_path}>{file.filename}</p>) : <p className="text-sm text-slate-500">Belum ada file PDF.</p>}
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Extracted text</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5">{detail?.submission?.extracted_text || detail?.submission?.submission_text || "Belum ada teks submission."}</pre>
          </div>
        </section>
      ) : (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Discussion Evidence</h3>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Thread title</p>
            <p className="text-sm">{detail?.activity.title ?? "-"}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Prompt diskusi</p>
            <p className="text-sm leading-6">{detail?.activity.prompt ?? "-"}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Komentar dan reply mahasiswa · {detail?.student.interaction_count ?? 0} interactions</p>
            <div className="grid max-h-52 gap-2 overflow-auto">
              {detail?.posts.length ? detail.posts.map((post, index) => <p className="rounded bg-slate-50 p-2 text-sm leading-6" key={index}>{post.content}</p>) : <p className="text-sm text-slate-500">Belum ada komentar.</p>}
            </div>
          </div>
        </section>
      )}

      {!assessment ? (
        <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-500">Belum ada assessment.</p>
      ) : (
        <section className="grid gap-3">
          <div className="flex items-end justify-between border-b border-slate-200 pb-3">
            <span className="text-sm font-medium">Recommended score</span>
            <strong className="text-4xl tabular-nums">{assessment.recommended_score}</strong>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Summary</p>
            <p className="text-sm leading-6">{assessment.summary}</p>
          </div>
          {assessment.manual_review_required ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{assessment.manual_review_reason ?? "Perlu review manual."}</p>
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
  );
}
