import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiGet, apiPost } from "../../../api/client";

interface ForumPost {
  id: string;
  moodle_post_id: string | null;
  parent_moodle_post_id: string | null;
  subject: string | null;
  content: string;
  reply_to: string | null;
  author_name: string;
  author_role: "student" | "tutor" | "system" | "unknown" | null;
  posted_at: string | null;
  has_rating_menu: number;
  rating_max: number | null;
  is_first_post: number;
}

interface ForumThread {
  activity: { title: string; prompt: string | null; course_context: string | null } | null;
  firstPost: ForumPost | null;
  posts: ForumPost[];
  suggestion: { id: string; suggestion: string; raw_json: unknown; created_at: string } | null;
}

interface ForumReference {
  id: string;
  raw_text: string;
  authors: string[] | null;
  year: number | null;
  title: string | null;
  source: string | null;
  doi: string | null;
  url: string | null;
  resolve_status: "pending" | "resolving" | "found" | "not_found" | "failed";
  resolve_source: string | null;
  resolved_pdf_path: string | null;
  resolved_pdf_url: string | null;
  resolved_metadata: any;
  resolve_error: string | null;
  relevance_status: "pending" | "analyzing" | "completed" | "failed";
  relevance: {
    validity?: string;
    relevance?: string;
    supports_argument?: boolean;
    possible_random_citation?: boolean;
    analysis?: string;
  } | null;
  relevance_error: string | null;
}

interface JobStatus {
  running: boolean;
  queued: number;
  pending: number;
}

function roleLabel(role: ForumPost["author_role"]) {
  if (role === "student") return "Mahasiswa";
  if (role === "tutor") return "Tutor";
  if (role === "system") return "Instruksi";
  return "Forum";
}

function Bubble({ post, actions }: { post: ForumPost; actions?: ReactNode }) {
  const isTutor = post.author_role === "tutor";
  const isStudent = post.author_role === "student";
  return (
    <div className={`grid gap-1 ${isTutor ? "justify-items-start" : "justify-items-end"}`}>
      <div
        className="max-w-[92%] rounded-lg border px-3 py-2"
        style={
          isTutor
            ? { background: "var(--bg-elevated)", borderColor: "var(--border-soft)" }
            : isStudent
              ? { background: "var(--bg-accent-soft)", borderColor: "var(--accent-strong)" }
              : { background: "var(--bg-surface)", borderColor: "var(--border-soft)" }
        }
      >
        <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          <span className="font-semibold text-secondary">{roleLabel(post.author_role)}</span>
          <span>·</span>
          <span>{post.author_name}</span>
          {post.posted_at ? <span>· {post.posted_at}</span> : null}
          {post.rating_max ? <span className="win-status">Skala 0-{post.rating_max}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-secondary">{post.content}</p>
        {actions ? <div className="mt-2 flex flex-wrap gap-1">{actions}</div> : null}
      </div>
    </div>
  );
}

function ReferenceStatus({ reference }: { reference: ForumReference }) {
  const relevance = reference.relevance?.relevance;
  return (
    <div className="flex flex-wrap gap-1">
      <span className="win-status">{reference.resolve_status}</span>
      {reference.resolve_source ? <span className="win-status">via {reference.resolve_source}</span> : null}
      <span className="win-status">relevansi: {reference.relevance_status}</span>
      {relevance ? <span className="win-status">{relevance}</span> : null}
      {reference.relevance?.possible_random_citation ? <span className="win-status text-warn">indikasi asal kutip</span> : null}
    </div>
  );
}

function ForumReferenceItem({ reference, onRefresh }: { reference: ForumReference; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const hasPdf = reference.resolve_status === "found" && reference.resolved_pdf_path;
  const landingUrl =
    reference.resolved_metadata?.landingUrl ??
    reference.resolved_metadata?.crossref?.landingUrl ??
    reference.resolved_metadata?.unpaywall?.landingUrl ??
    reference.resolved_metadata?.arxiv?.landingUrl ??
    reference.url ??
    null;

  async function run(path: string, label: string) {
    setBusy(label);
    try {
      await apiPost(path);
      setTimeout(() => {
        setBusy(null);
        onRefresh();
      }, 1800);
    } catch (error) {
      setBusy(null);
      console.error(error);
    }
  }

  return (
    <div className="win-inset grid gap-2 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium leading-snug">{reference.title ?? reference.raw_text}</p>
          <p className="text-[11.5px] text-muted">
            {(reference.authors ?? []).join(", ") || "Penulis tidak terdeteksi"}
            {reference.year ? ` · ${reference.year}` : ""}
            {reference.source ? ` · ${reference.source}` : ""}
          </p>
          {reference.title ? <p className="mt-1 text-[11px] text-muted">{reference.raw_text}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {hasPdf ? (
            <button className="win-button win-button-primary" onClick={() => setExpanded((current) => !current)}>
              {expanded ? "Tutup" : "Preview"}
            </button>
          ) : (
            <button
              className="win-button"
              disabled={Boolean(busy)}
              onClick={() => run(`/api/forum/references/${encodeURIComponent(reference.id)}/resolve`, "Mencari")}
            >
              {busy === "Mencari" ? "Mencari…" : "Cari PDF"}
            </button>
          )}
          <button
            className="win-button"
            disabled={Boolean(busy)}
            onClick={() => run(`/api/forum/references/${encodeURIComponent(reference.id)}/analyze`, "Analisis")}
          >
            {busy === "Analisis" ? "Analisis…" : "Analisis"}
          </button>
          {landingUrl ? (
            <a className="win-button" href={landingUrl} target="_blank" rel="noreferrer">
              Buka
            </a>
          ) : null}
        </div>
      </div>
      <ReferenceStatus reference={reference} />
      {reference.relevance?.analysis ? <p className="text-[11.5px] leading-relaxed text-secondary">{reference.relevance.analysis}</p> : null}
      {reference.resolve_error ? <p className="win-status text-danger">{reference.resolve_error}</p> : null}
      {reference.relevance_error ? <p className="win-status text-danger">{reference.relevance_error}</p> : null}
      {expanded && hasPdf ? (
        <iframe
          className="win-inset h-96 w-full"
          title={reference.title ?? reference.raw_text}
          src={`/api/forum/references/${encodeURIComponent(reference.id)}/preview`}
        />
      ) : null}
    </div>
  );
}

export function ForumThreadPanel({
  studentId,
  onReviewGenerated,
}: {
  studentId: string;
  onReviewGenerated?: () => void;
}) {
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [refs, setRefs] = useState<ForumReference[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkingReferences, setCheckingReferences] = useState(false);

  const loadThread = () => {
    apiGet<ForumThread | null>(`/api/students/${encodeURIComponent(studentId)}/forum-thread`)
      .then(setThread)
      .catch(() => setThread(null));
  };
  const loadRefs = () => {
    apiGet<ForumReference[]>(`/api/forum/students/${encodeURIComponent(studentId)}/references`)
      .then(setRefs)
      .catch(() => setRefs([]));
  };

  useEffect(() => {
    loadThread();
    loadRefs();
  }, [studentId]);

  useEffect(() => {
    if (!refs.some((ref) => ["pending", "resolving"].includes(ref.resolve_status) || ["pending", "analyzing"].includes(ref.relevance_status))) return;
    const id = setTimeout(loadRefs, 4000);
    return () => clearTimeout(id);
  }, [refs]);

  useEffect(() => {
    if (!checkingReferences) return;
    let cancelled = false;

    async function poll() {
      loadRefs();
      const [enrichment, reference] = await Promise.all([
        apiGet<JobStatus>("/api/jobs/enrichment").catch(() => null),
        apiGet<JobStatus>("/api/jobs/reference").catch(() => null),
      ]);
      if (cancelled) return;
      const active = Boolean(
        enrichment?.running || enrichment?.pending || reference?.running || reference?.pending,
      );
      if (active) {
        setStatus(
          `Cek referensi berjalan di background · ekstraksi ${enrichment?.pending ?? 0}, pencarian PDF/analisis ${reference?.pending ?? 0}`,
        );
        return;
      }
      setCheckingReferences(false);
      setStatus("Cek referensi selesai. Hasil akan muncul di daftar referensi jika ada yang terdeteksi.");
      loadRefs();
    }

    void poll();
    const id = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [checkingReferences, studentId]);

  async function runAction(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setStatus(label);
    try {
      await action();
      setStatus(`${label} selesai`);
      loadThread();
      loadRefs();
      onReviewGenerated?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} gagal`);
    } finally {
      setBusy(null);
    }
  }

  async function refreshReferences() {
    setBusy("Cek referensi");
    setCheckingReferences(true);
    setStatus("Cek referensi dimulai: mengekstrak referensi dari jawaban dan follow-up mahasiswa…");
    try {
      await apiPost(`/api/forum/students/${encodeURIComponent(studentId)}/references/refresh`);
      setStatus("Cek referensi masuk antrean. Pencarian PDF dan analisis relevansi berjalan di background.");
      setTimeout(loadRefs, 1500);
    } catch (error) {
      setCheckingReferences(false);
      setStatus(error instanceof Error ? error.message : "Cek referensi gagal");
    } finally {
      setBusy(null);
    }
  }

  const studentActions = (
    <>
      <button
        className="win-button"
        disabled={Boolean(busy)}
        onClick={() => runAction("Review AI", () => apiPost(`/api/forum/students/${encodeURIComponent(studentId)}/review`))}
      >
        Review AI
      </button>
      <button
        className="win-button"
        disabled={Boolean(busy)}
        onClick={() => runAction("Saran reply tutor", () => apiPost(`/api/forum/students/${encodeURIComponent(studentId)}/reply-suggestion`))}
      >
        Saran reply tutor
      </button>
      <button
        className="win-button"
        disabled={Boolean(busy) || checkingReferences}
        onClick={refreshReferences}
      >
        {checkingReferences ? "Mengecek…" : "Cek referensi"}
      </button>
    </>
  );

  const firstPost = thread?.firstPost?.content || thread?.activity?.prompt || "Belum ada instruksi forum.";
  const posts = thread?.posts ?? [];
  const suggestion = thread?.suggestion?.suggestion ?? null;

  return (
    <section className="grid gap-3">
      <h3 className="win-section-title">Forum thread</h3>
      {status ? <p className="win-status">{status}</p> : null}
      <div className="win-inset grid gap-1 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Instruksi / Study Case</span>
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-secondary">{firstPost}</p>
      </div>
      <div className="grid gap-2">
        {posts.length ? (
          posts.map((post, index) => (
            <Bubble
              key={post.id}
              post={post}
              actions={post.author_role === "student" && index === posts.findIndex((item) => item.author_role === "student") ? studentActions : null}
            />
          ))
        ) : (
          <p className="win-status text-muted">Belum ada thread mahasiswa tersimpan. Sync forum terlebih dahulu.</p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="win-section-title m-0">Saran reply tutor</span>
          {suggestion ? (
            <button className="win-button" onClick={() => navigator.clipboard?.writeText(suggestion)}>
              Copy
            </button>
          ) : null}
        </div>
        {suggestion ? (
          <div className="win-inset px-3 py-2 text-[12.5px] leading-relaxed text-secondary">{suggestion}</div>
        ) : (
          <p className="text-[11.5px] text-muted">Belum ada saran reply. Klik aksi di bubble mahasiswa.</p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="win-section-title m-0">Referensi forum · {refs.length}</span>
          <button
            className="win-button"
            disabled={Boolean(busy) || checkingReferences}
            onClick={refreshReferences}
          >
            {checkingReferences ? "Mengecek…" : "Refresh"}
          </button>
        </div>
        {checkingReferences ? (
          <p className="win-status text-[var(--accent)]">
            Sedang mengekstrak referensi, mencari PDF, dan menjalankan analisis relevansi. Kamu tetap bisa lanjut membaca thread.
          </p>
        ) : null}
        {!refs.length ? <p className="text-[11.5px] text-muted">Belum ada referensi terdeteksi.</p> : null}
        <div className="grid gap-2">
          {refs.map((reference) => (
            <ForumReferenceItem key={reference.id} reference={reference} onRefresh={loadRefs} />
          ))}
        </div>
      </div>
    </section>
  );
}
