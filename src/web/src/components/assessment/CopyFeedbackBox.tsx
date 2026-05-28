import { Clipboard } from "lucide-react";

export function CopyFeedbackBox({ feedback }: { feedback: string }) {
  return (
    <div className="feedback-box">
      <div className="feedback-header">
        <span>Feedback</span>
        <button onClick={() => navigator.clipboard.writeText(feedback)} aria-label="Copy feedback">
          <Clipboard size={16} />
        </button>
      </div>
      <textarea value={feedback} readOnly />
    </div>
  );
}
