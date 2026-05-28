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

export function StudentItem({ student, active, checked, onCheckedChange, onClick }: Props) {
  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 p-1 ${active ? "win-button active" : "win-button"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} aria-label={`Select ${student.student_name}`} />
      <button className="min-w-0 text-left" onClick={onClick}>
        <span className="block truncate font-bold">{student.student_name}</span>
        <span>
          {student.submission_status ?? "unknown"} · {student.ai_status}
          {student.interaction_count ? ` · ${student.interaction_count} interactions` : ""}
        </span>
      </button>
      <strong>{student.recommended_score ?? "-"}</strong>
    </div>
  );
}
