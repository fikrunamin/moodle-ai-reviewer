import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api/client";
import { ReferenceItem } from "./ReferenceItem";

interface Reference {
  id: string;
  raw_text: string;
  authors: string[] | null;
  year: number | null;
  title: string | null;
  source: string | null;
  doi: string | null;
  url: string | null;
  arxiv_id: string | null;
  parse_status: string;
  resolve_status: "pending" | "resolving" | "found" | "not_found" | "failed";
  resolve_source: string | null;
  resolved_pdf_path: string | null;
  resolved_pdf_url: string | null;
  resolved_metadata: any;
  resolve_error: string | null;
}

export function ReferencesSection({ submissionId }: { submissionId: string }) {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    apiGet<Reference[]>(`/api/submissions/${encodeURIComponent(submissionId)}/references`)
      .then(setRefs)
      .catch(() => setRefs([]));
  };

  useEffect(() => {
    load();
  }, [submissionId]);

  // Auto-poll if any reference is resolving
  useEffect(() => {
    if (!refs.length) return;
    const stillBusy = refs.some(
      (ref) => ref.resolve_status === "pending" || ref.resolve_status === "resolving",
    );
    if (!stillBusy) return;
    const id = setTimeout(load, 4000);
    return () => clearTimeout(id);
  }, [refs]);

  const refresh = async () => {
    setBusy(true);
    setStatus("Mengekstrak referensi...");
    try {
      await apiPost(`/api/submissions/${encodeURIComponent(submissionId)}/references/refresh`);
      setTimeout(() => {
        load();
        setStatus(null);
        setBusy(false);
      }, 2500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed");
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="win-section-title m-0">📚 References ({refs.length})</h3>
        <button className="win-button" disabled={busy} onClick={refresh}>
          {busy ? "⏳ Refresh" : "🔁 Refresh"}
        </button>
      </div>
      {status ? <p className="win-status">{status}</p> : null}
      {!refs.length && !busy ? (
        <p className="text-xs">
          Belum ada referensi terdeteksi. Coba klik Refresh setelah PDF diproses.
        </p>
      ) : null}
      <div className="grid gap-2">
        {refs.map((reference) => (
          <ReferenceItem key={reference.id} reference={reference} onResolved={load} />
        ))}
      </div>
    </section>
  );
}
