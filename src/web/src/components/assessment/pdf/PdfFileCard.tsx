import { PdfSummarySection } from "./PdfSummarySection";

export function PdfFileCard({
  fileId,
  filename,
}: {
  fileId: string;
  filename: string;
}) {
  return (
    <div className="win-inset grid gap-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium">{filename}</p>
        <a
          className="win-button"
          href={`/api/files/${encodeURIComponent(fileId)}/preview`}
          target="_blank"
          rel="noreferrer"
        >
          Open
        </a>
      </div>
      <iframe
        className="win-inset h-72 w-full"
        title={filename}
        src={`/api/files/${encodeURIComponent(fileId)}/preview`}
      />
      <div className="border-t divider pt-2">
        <PdfSummarySection fileId={fileId} />
      </div>
    </div>
  );
}
