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

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: "muted" | "success" | "warn" | "danger" | "accent" }
> = {
  pending: { label: "Menunggu", tone: "muted" },
  resolving: { label: "Mencari…", tone: "accent" },
  found: { label: "Ditemukan", tone: "success" },
  not_found: { label: "Tidak ditemukan", tone: "warn" },
  failed: { label: "Gagal", tone: "danger" },
};

function StatusPill({ status }: { status: keyof typeof STATUS_CONFIG | string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, tone: "muted" as const };
  const colorClass =
    config.tone === "success"
      ? "text-success"
      : config.tone === "warn"
        ? "text-warn"
        : config.tone === "danger"
          ? "text-danger"
          : config.tone === "accent"
            ? "text-[var(--accent)]"
            : "text-muted";
  return <span className={`win-status ${colorClass}`}>{config.label}</span>;
}

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
    <div className="win-inset grid gap-2 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {reference.title ? (
            <p className="text-[12.5px] font-medium leading-snug">{reference.title}</p>
          ) : null}
          <p className="text-[11.5px] leading-snug text-secondary">
            {(reference.authors ?? []).join(", ") || "Penulis tidak terdeteksi"}
            {reference.year ? ` · ${reference.year}` : ""}
            {reference.source ? ` · ${reference.source}` : ""}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted">{reference.raw_text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <StatusPill status={reference.resolve_status} />
            {reference.resolve_source && reference.resolve_status === "found" ? (
              <span className="win-status">via {reference.resolve_source}</span>
            ) : null}
            {reference.doi ? (
              <a
                className="text-[11px]"
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noreferrer"
              >
                DOI {reference.doi}
              </a>
            ) : null}
            {reference.arxiv_id ? (
              <a
                className="text-[11px]"
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
            <button
              className="win-button win-button-primary"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Tutup" : "Preview"}
            </button>
          ) : (
            <button className="win-button" disabled={busy} onClick={resolve}>
              {busy ? "Mencari…" : "Cari PDF"}
            </button>
          )}
          {landingUrl ? (
            <a className="win-button" href={landingUrl} target="_blank" rel="noreferrer">
              Buka
            </a>
          ) : null}
          {!hasPdf && scholarUrl ? (
            <a className="win-button" href={scholarUrl} target="_blank" rel="noreferrer">
              Scholar
            </a>
          ) : null}
        </div>
      </div>

      {reference.resolve_status === "failed" && reference.resolve_error ? (
        <p className="win-status text-danger">{reference.resolve_error}</p>
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
