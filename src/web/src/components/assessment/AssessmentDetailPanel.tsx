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
    instruction_files: string | null;
    instruction_brief: string | null;
    instruction_doc_text: string | null;
    prompt: string | null;
    rubric_file_path: string | null;
    rubric_ai_json: string | null;
    rubric_extracted_text: string | null;
  };
  submission: { id?: string; submission_text: string | null; extracted_text: string | null } | null;
  files: Array<{ id: string; filename: string; file_path: string; preview_pdf_path: string | null; extracted_text_path: string | null }>;
  posts: Array<{ content: string; reply_to: string | null }>;
}

interface InstructionFileMeta {
  url: string;
  filename: string;
  kind: "pdf" | "docx" | "other";
}

interface InstructionBrief {
  summary?: string;
  objectives?: string[];
  deliverables?: string[];
  requirements?: string[];
  deadline?: string | null;
  submission_format?: string | null;
  grading_notes?: string[];
  rubric?: {
    rubric_summary?: string;
    criteria?: Array<{ name?: string; max_score?: number; description?: string }>;
  } | null;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="win-section-title">{label}</span>
      <div className="win-inset px-3 py-2 text-[12.5px] leading-relaxed text-secondary">{children}</div>
    </div>
  );
}

function BriefList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <ul className="ml-4 grid list-disc gap-0.5 text-[12px] leading-relaxed">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function InstructionBriefView({
  brief,
  files,
}: {
  brief: InstructionBrief | null;
  files: InstructionFileMeta[];
}) {
  const hasBrief =
    brief &&
    (brief.summary ||
      brief.objectives?.length ||
      brief.deliverables?.length ||
      brief.requirements?.length ||
      brief.grading_notes?.length ||
      brief.deadline ||
      brief.submission_format ||
      brief.rubric?.criteria?.length);

  if (!hasBrief && files.length === 0) return null;

  return (
    <div className="grid gap-1">
      <span className="win-section-title">Arahan tugas (dari dokumen)</span>
      <div className="win-inset grid gap-2 px-3 py-2 text-[12.5px] leading-relaxed text-secondary">
        {files.length ? (
          <div className="flex flex-wrap gap-1">
            {files.map((file) => (
              <a
                key={file.url}
                className="win-status"
                href={file.url}
                target="_blank"
                rel="noreferrer"
                title={file.filename}
              >
                {file.kind.toUpperCase()} · {file.filename}
              </a>
            ))}
          </div>
        ) : null}
        {brief?.summary ? <p>{brief.summary}</p> : null}
        <BriefList label="Tujuan" items={brief?.objectives} />
        <BriefList label="Yang dikumpulkan" items={brief?.deliverables} />
        <BriefList label="Persyaratan" items={brief?.requirements} />
        <BriefList label="Yang dinilai" items={brief?.grading_notes} />
        {brief?.rubric?.criteria?.length ? (
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold text-muted">Rubrik terdeteksi</span>
            {brief.rubric.rubric_summary ? <p className="text-[12px]">{brief.rubric.rubric_summary}</p> : null}
            <ul className="ml-4 grid list-disc gap-0.5 text-[12px] leading-relaxed">
              {brief.rubric.criteria.map((criteria, index) => (
                <li key={index}>
                  {criteria.name ?? "Kriteria"}
                  {criteria.max_score ? ` (${criteria.max_score})` : ""}
                  {criteria.description ? `: ${criteria.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {brief?.deadline ? (
          <p className="text-[12px]">
            <span className="text-muted">Deadline:</span> {brief.deadline}
          </p>
        ) : null}
        {brief?.submission_format ? (
          <p className="text-[12px]">
            <span className="text-muted">Format:</span> {brief.submission_format}
          </p>
        ) : null}
        {!hasBrief && files.length ? (
          <p className="text-[11.5px] text-muted">
            File instruksi terdeteksi. Analisa arahan akan muncul setelah sync dengan AI aktif.
          </p>
        ) : null}
      </div>
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
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

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
  const panelClass = fullscreen
    ? "win-window win-scroll fixed inset-2 z-50 flex flex-col overflow-y-auto shadow-2xl"
    : "win-window win-scroll flex h-full flex-col overflow-y-auto";

  return (
    <div className={panelClass}>
      <div className="win-titlebar sticky top-0 z-10">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold">{detail?.student.student_name ?? "Assessment"}</h2>
          <p className="truncate text-[11px] text-muted">{type ?? "No activity selected"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="win-button" onClick={() => setFullscreen((current) => !current)}>
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <button className="win-button win-button-primary" disabled={busy} onClick={generate}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
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
            <InstructionBriefView
              brief={parseJson<InstructionBrief>(detail?.activity.instruction_brief ?? null)}
              files={parseJson<InstructionFileMeta[]>(detail?.activity.instruction_files ?? null) ?? []}
            />
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
                    <PdfFileCard
                      key={file.id}
                      fileId={file.id}
                      filename={file.filename}
                      hasPdfPreview={Boolean(file.preview_pdf_path) || file.filename.toLowerCase().endsWith(".pdf")}
                    />
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
