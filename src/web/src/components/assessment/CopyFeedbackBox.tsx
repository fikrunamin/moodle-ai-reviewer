import { useState } from "react";

export function CopyFeedbackBox({ feedback }: { feedback: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="win-section-title m-0">Feedback siap salin</span>
        <button
          className="win-button"
          aria-label="Copy feedback"
          onClick={async () => {
            await navigator.clipboard.writeText(feedback);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "Tersalin" : "Copy"}
        </button>
      </div>
      <textarea className="win-textarea min-h-32 resize-y font-mono" value={feedback} readOnly />
    </div>
  );
}
