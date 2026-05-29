import { useState } from "react";
import { apiPost } from "../../../api/client";

interface ResolvedMetadata {
  scholarUrl?: string | null;
  landingUrl?: string | null;
  downloadedFrom?: string | null;
  crossref?: { landingUrl?: string | null; doi?: string } | null;
  unpaywall?: { landingUrl?: string | null } | null;
  arxiv?: { landingUrl?: string | null } | null;
  lastError?: string | null;
}

export interface ReferenceItemProps {
  reference: {
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
    resolved_metadata: ResolvedMetadata | null;
    resolve_error: string | null;
  };
  onResolved?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  resolving: "Mencari...",
  found: "Ditemukan",
  not_found: "Tidak ditemukan",
  failed: "Gagal",
};

export function ReferenceItem({ reference, onResolved }: ReferenceItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const meta = reference.resolved_metadata ?? null;
  const landingUrl =
    meta?.landingUrl ??
    meta?.unpaywall?.landingUrl ??
    meta?.crossref?.landingUrl ??
    meta?.arxiv?.landingUrl ??
    reference.url ??
    null;
  const scholarUrl = meta?.scholarUrl ?? null;

  const resolve = async () => {
    setBusy(true);
    try {
      await apiPost(`/api/references/${encodeURIComponent(reference.id)}/resolve`);
      setTimeout(() => {
        setBusy(false);
        onResolved?.();
      }, 2000);
    } catch (error) {
      setBusy(false);
      console.error(error);
    }
  };

  const hasPdf = reference.resolve_status === "found" && reference.resolved_pdf_path;

  return (
    <div className="win-inset grid gap-2 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {reference.title ? (
            <p className="text-sm font-medium leading-5">{reference.title}</p>
          ) : null}
          <p className="text-xs leading-5 text-slate-800">
            {(reference.authors ?? []).join(", ") || "Penulis tidak terdeteksi"}
            {reference.year ? ` · ${reference.year}` : ""}
            {reference.source ? ` · ${reference.source}` : ""}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-700">{reference.raw_text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            <span className="win-status">{STATUS_LABEL[reference.resolve_status] ?? reference.resolve_status}</span>
            {reference.resolve_source && reference.resolve_status === "found" ? (
              <span className="win-status">via {reference.resolve_source}</span>
            ) : null}
            {reference.doi ? (
              <a
                className="underline"
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noreferrer"
              >
                DOI {reference.doi}
              </a>
            ) : null}
            {reference.arxiv_id ? (
              <a
                className="underline"
                href={`https://arxiv.org/abs/${reference.arxiv_id}`}
                target="_blank"
                rel="noreferrer"
              >
                arXiv {reference.arxiv_id}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {hasPdf ? (
            <button className="win-button" onClick={() => setExpanded((current) => !current)}>
              {expanded ? "▲ Tutup" : "📄 Preview"}
            </button>
          ) : (
            <button className="win-button" disabled={busy} onClick={resolve}>
              {busy ? "⏳ Cari" : "🔎 Cari PDF"}
            </button>
          )}
          {landingUrl ? (
            <a className="win-button px-2 py-1 text-center" href={landingUrl} target="_blank" rel="noreferrer">
              ↗ Buka
            </a>
          ) : null}
          {!hasPdf && scholarUrl ? (
            <a
              className="win-button px-2 py-1 text-center"
              href={scholarUrl}
              target="_blank"
              rel="noreferrer"
            >
              🎓 Scholar
            </a>
          ) : null}
        </div>
      </div>

      {reference.resolve_status === "failed" && reference.resolve_error ? (
        <p className="win-status text-xs">⚠️ {reference.resolve_error}</p>
      ) : null}

      {expanded && hasPdf ? (
        <iframe
          title={reference.title ?? reference.raw_text}
          className="win-inset h-96 w-full"
          src={`/api/references/${encodeURIComponent(reference.id)}/preview`}
        />
      ) : null}
    </div>
  );
}
