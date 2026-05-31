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
    <div className="grid grid-cols-3 gap-1">
      <button
        className="win-button win-button-primary"
        disabled={disabled}
        onClick={onGenerateSelected}
        title="Generate untuk yang dipilih"
      >
        Selected
      </button>
      <button
        className="win-button"
        disabled={missingDisabled}
        onClick={onGenerateMissing}
        title="Generate untuk yang belum ada review"
      >
        Missing
      </button>
      <button
        className="win-button"
        disabled={disabled}
        onClick={onRegenerateSelected}
        title="Regenerate review yang dipilih"
      >
        Regenerate
      </button>
    </div>
  );
}
