import { Clipboard } from "lucide-react";

export function CopyFeedbackBox({ feedback }: { feedback: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">Feedback siap salin</span>
        <button className="grid h-8 w-8 place-items-center rounded-md border border-slate-300 hover:bg-slate-50" onClick={() => navigator.clipboard.writeText(feedback)} aria-label="Copy feedback">
          <Clipboard size={16} />
        </button>
      </div>
      <textarea className="min-h-44 resize-y rounded-md border border-slate-300 p-3 text-sm leading-6" value={feedback} readOnly />
    </div>
  );
}
