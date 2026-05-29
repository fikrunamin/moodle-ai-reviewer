import { PdfSummarySection } from "./PdfSummarySection";

export function PdfFileCard({
  fileId,
  filename,
}: {
  fileId: string;
  filename: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{filename}</p>
      <iframe
        className="win-inset h-80 w-full"
        title={filename}
        src={`/api/files/${encodeURIComponent(fileId)}/preview`}
      />
      <div className="flex items-center gap-2">
        <a
          className="win-button px-2 py-1"
          href={`/api/files/${encodeURIComponent(fileId)}/preview`}
          target="_blank"
          rel="noreferrer"
        >
          🔎 Open PDF
        </a>
      </div>
      <div className="win-inset p-2">
        <PdfSummarySection fileId={fileId} />
      </div>
    </div>
  );
}
