import { useState } from "react";

interface Props {
  videoId: string;
  url: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  oembedStatus: "ok" | "failed" | "skipped" | "pending" | null;
}

export function YouTubePreview({ videoId, url, title, author, thumbnailUrl, oembedStatus }: Props) {
  const [playing, setPlaying] = useState(false);
  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const thumb = thumbnailUrl ?? fallbackThumb;
  const displayTitle = title ?? "YouTube video";

  if (playing) {
    return (
      <div className="grid gap-1">
        <iframe
          className="win-inset aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={displayTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div className="flex items-center justify-between gap-2">
          <a className="truncate text-[12px]" href={url} target="_blank" rel="noreferrer">
            {displayTitle}
          </a>
          <button className="win-button" onClick={() => setPlaying(false)}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        className="win-inset relative grid w-full place-items-center overflow-hidden p-0"
        onClick={() => setPlaying(true)}
        aria-label={`Play ${displayTitle}`}
      >
        <img
          src={thumb}
          alt={displayTitle}
          className="aspect-video w-full object-cover opacity-90 transition-opacity hover:opacity-100"
          loading="lazy"
        />
        <span
          aria-hidden
          className="absolute grid h-12 w-12 place-items-center rounded-full bg-black/70 text-xl text-white shadow-lg backdrop-blur-sm"
        >
          ▶
        </span>
      </button>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium">{displayTitle}</p>
          {author ? <p className="truncate text-[11px] text-muted">{author}</p> : null}
          {oembedStatus === "failed" ? (
            <p className="text-[11px] text-muted">Metadata tidak tersedia, klik untuk memutar.</p>
          ) : null}
        </div>
        <a className="win-button" href={url} target="_blank" rel="noreferrer">
          Buka
        </a>
      </div>
    </div>
  );
}
