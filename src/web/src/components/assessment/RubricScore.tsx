export function RubricScore({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
      <span>{label}</span>
      <strong className="tabular-nums">
        {score}/{maxScore}
      </strong>
    </div>
  );
}
