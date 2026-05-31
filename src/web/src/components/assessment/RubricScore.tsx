export function RubricScore({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const ratio = maxScore > 0 ? Math.max(0, Math.min(1, score / maxScore)) : 0;
  return (
    <div className="grid gap-1 px-1 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="truncate text-secondary">{label}</span>
        <strong className="tabular-nums">
          {score}
          <span className="text-muted">/{maxScore}</span>
        </strong>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${ratio * 100}%`,
            background: "linear-gradient(90deg, var(--accent-strong), var(--accent))",
          }}
        />
      </div>
    </div>
  );
}
