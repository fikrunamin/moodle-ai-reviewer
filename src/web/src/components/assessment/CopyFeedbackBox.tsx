export function CopyFeedbackBox({ feedback }: { feedback: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">Feedback siap salin</span>
        <button className="win-button" onClick={() => navigator.clipboard.writeText(feedback)} aria-label="Copy feedback">
          📋 Copy
        </button>
      </div>
      <textarea className="win-textarea min-h-32 resize-y" value={feedback} readOnly />
    </div>
  );
}
