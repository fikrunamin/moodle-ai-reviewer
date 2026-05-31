import { PdfSummarySection } from "./PdfSummarySection";

export function PdfFileCard({
  fileId,
  filename,
  hasPdfPreview = false,
}: {
  fileId: string;
  filename: string;
  hasPdfPreview?: boolean;
}) {
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  const previewUrl = `/api/files/${encodeURIComponent(fileId)}/preview`;
  const canPreview = isPdf || hasPdfPreview;

  return (
    <div className="win-inset grid gap-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium">{filename}</p>
        <a className="win-button" href={previewUrl} target="_blank" rel="noreferrer">
          {canPreview ? "Open" : "Download"}
        </a>
      </div>
      {canPreview ? (
        <iframe className="win-inset h-72 w-full" title={filename} src={previewUrl} />
      ) : (
        <p className="win-status text-muted">
          Preview tidak tersedia untuk file ini. Teks tetap diekstrak untuk ringkasan & review.
        </p>
      )}
      {!isPdf && hasPdfPreview ? (
        <p className="text-[11px] text-muted">Preview di-render dari DOCX.</p>
      ) : null}
      <div className="border-t divider pt-2">
        <PdfSummarySection fileId={fileId} />
      </div>
    </div>
  );
}
