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
    <div className="grid grid-cols-1 gap-1 xl:grid-cols-3">
      <button className="win-button" disabled={disabled} onClick={onGenerateSelected}>
        ✨ Selected
      </button>
      <button className="win-button" disabled={missingDisabled} onClick={onGenerateMissing}>
        ✨ Missing
      </button>
      <button className="win-button" disabled={disabled} onClick={onRegenerateSelected}>
        🔁 Regenerate
      </button>
    </div>
  );
}
