import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api/client";

interface PdfSummary {
  id: string;
  file_id: string;
  summary: string;
  bullet_points: string[];
  language: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function PdfSummarySection({ fileId }: { fileId: string }) {
  const [summary, setSummary] = useState<PdfSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiGet<PdfSummary | null>(`/api/files/${encodeURIComponent(fileId)}/summary`)
      .then((data) => {
        setSummary(data);
        setError(null);
      })
      .catch(() => setSummary(null));
  };

  useEffect(() => {
    load();
  }, [fileId]);

  const summarize = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<PdfSummary>(
        `/api/files/${encodeURIComponent(fileId)}/summarize`,
        { force },
      );
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summarize failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">Ringkasan AI</span>
        <button
          className="win-button"
          disabled={loading}
          onClick={() => summarize(Boolean(summary))}
        >
          {loading
            ? "⏳ Meringkas"
            : summary
              ? "🔁 Ringkas ulang"
              : "🪄 Ringkas PDF"}
        </button>
      </div>
      {error ? <p className="win-status">⚠️ {error}</p> : null}
      {summary?.status === "failed" && !error ? (
        <p className="win-status">⚠️ {summary.error ?? "Gagal meringkas."}</p>
      ) : null}
      {summary && summary.status === "completed" ? (
        <div className="grid gap-2">
          <p className="text-sm leading-6">{summary.summary}</p>
          {summary.bullet_points.length ? (
            <ul className="ml-4 list-disc text-xs leading-5">
              {summary.bullet_points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : !loading && !summary ? (
        <p className="text-xs">Belum ada ringkasan untuk file ini.</p>
      ) : null}
    </div>
  );
}
