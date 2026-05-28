export function RubricScore({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  return (
    <div className="win-status flex items-center justify-between gap-2">
      <span>{label}</span>
      <strong className="tabular-nums">
        {score}/{maxScore}
      </strong>
    </div>
  );
}
