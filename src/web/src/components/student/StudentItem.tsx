interface Student {
  id: string;
  student_name: string;
  ai_status: string;
  recommended_score: number | null;
  submission_status?: string | null;
  interaction_count?: number;
}

interface Props {
  student: Student;
  active: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClick: () => void;
}

const AI_TONE: Record<string, string> = {
  pending: "text-muted",
  processing: "text-warn",
  completed: "text-success",
  failed: "text-danger",
};

export function StudentItem({ student, active, checked, onCheckedChange, onClick }: Props) {
  const tone = AI_TONE[student.ai_status] ?? "text-muted";
  return (
    <div
      className={`win-inset grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1.5 transition-colors ${
        active ? "border-[var(--accent-strong)] bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
      }`}
    >
      <input
        type="checkbox"
        className="accent-[var(--accent-strong)]"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-label={`Select ${student.student_name}`}
      />
      <button className="min-w-0 text-left" onClick={onClick}>
        <span className="block truncate text-[12.5px] font-medium">{student.student_name}</span>
        <span className="block truncate text-[10.5px] text-muted">
          <span>{student.submission_status ?? "unknown"}</span>
          <span className={`ml-1 ${tone}`}>· {student.ai_status}</span>
          {student.interaction_count ? <span> · {student.interaction_count} interaksi</span> : null}
        </span>
      </button>
      <strong className="tabular-nums text-[13px]">{student.recommended_score ?? "—"}</strong>
    </div>
  );
}
