import { RotateCcw, Wand2 } from "lucide-react";

export function BulkActionBar({
  disabled,
  missingDisabled,
  onGenerateSelected,
  onGenerateMissing,
  onRegenerateSelected,
}: {
  disabled: boolean;
  missingDisabled: boolean;
  onGenerateSelected: () => void;
  onGenerateMissing: () => void;
  onRegenerateSelected: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
      <button className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={disabled} onClick={onGenerateSelected}>
        <Wand2 size={16} />
        Generate Selected
      </button>
      <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={missingDisabled} onClick={onGenerateMissing}>
        <Wand2 size={16} />
        Generate Missing
      </button>
      <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={disabled} onClick={onRegenerateSelected}>
        <RotateCcw size={16} />
        Regenerate
      </button>
    </div>
  );
}
