import { RefreshCw, Wand2 } from "lucide-react";

export function BulkActionBar({ disabled }: { disabled: boolean }) {
  return (
    <div className="bulk-bar">
      <button disabled={disabled}>
        <RefreshCw size={16} />
        Sync
      </button>
      <button disabled={disabled}>
        <Wand2 size={16} />
        Generate
      </button>
    </div>
  );
}
