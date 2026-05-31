import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api/client";
import { YouTubePreview } from "./YouTubePreview";

interface ExtractedLink {
  id: string;
  url: string;
  kind: "youtube" | "doi" | "arxiv" | "generic";
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_author: string | null;
  youtube_thumbnail_url: string | null;
  oembed_status: "ok" | "failed" | "skipped" | "pending" | null;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinksSection({ submissionId }: { submissionId: string }) {
  const [links, setLinks] = useState<ExtractedLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    apiGet<ExtractedLink[]>(`/api/submissions/${encodeURIComponent(submissionId)}/links`)
      .then(setLinks)
      .catch(() => setLinks([]));
  };

  useEffect(() => {
    load();
  }, [submissionId]);

  const refresh = async () => {
    setBusy(true);
    setStatus("Mengekstrak link…");
    try {
      await apiPost(`/api/submissions/${encodeURIComponent(submissionId)}/links/refresh`);
      setTimeout(() => {
        load();
        setStatus(null);
        setBusy(false);
      }, 1500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed");
      setBusy(false);
    }
  };

  const youtubeLinks = links.filter((link) => link.kind === "youtube" && link.youtube_video_id);
  const otherLinks = links.filter((link) => link.kind !== "youtube" || !link.youtube_video_id);

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="win-section-title m-0">Links · {links.length}</h3>
        <button className="win-button" disabled={busy} onClick={refresh}>
          {busy ? "Refresh…" : "Refresh"}
        </button>
      </div>
      {status ? <p className="win-status">{status}</p> : null}

      {youtubeLinks.length ? (
        <div className="grid gap-2">
          {youtubeLinks.map((link) => (
            <YouTubePreview
              key={link.id}
              videoId={link.youtube_video_id!}
              url={link.url}
              title={link.youtube_title}
              author={link.youtube_author}
              thumbnailUrl={link.youtube_thumbnail_url}
              oembedStatus={link.oembed_status}
            />
          ))}
        </div>
      ) : null}

      {otherLinks.length ? (
        <ul className="grid gap-1">
          {otherLinks.map((link) => (
            <li
              key={link.id}
              className="win-inset flex items-center justify-between gap-2 px-2.5 py-1.5"
            >
              <a
                className="truncate text-[12px]"
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {hostname(link.url)}
              </a>
              <span className="text-[10.5px] uppercase tracking-wider text-muted">{link.kind}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!links.length && !busy ? (
        <p className="text-[11.5px] text-muted">Belum ada link yang ditemukan.</p>
      ) : null}
    </section>
  );
}
