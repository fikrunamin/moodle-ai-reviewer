export function RubricScore({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  return (
    <div className="rubric-score">
      <span>{label}</span>
      <strong>
        {score}/{maxScore}
      </strong>
    </div>
  );
}
