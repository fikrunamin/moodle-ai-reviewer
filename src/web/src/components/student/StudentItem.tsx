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
    <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border p-3 ${active ? "border-teal-700 bg-teal-50" : "border-slate-200"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} aria-label={`Select ${student.student_name}`} />
      <button className="min-w-0 text-left" onClick={onClick}>
        <span className="block truncate text-sm font-medium">{student.student_name}</span>
        <span className="text-xs text-slate-500">
          {student.submission_status ?? "unknown"} · {student.ai_status}
          {student.interaction_count ? ` · ${student.interaction_count} interactions` : ""}
        </span>
      </button>
      <strong className="text-sm">{student.recommended_score ?? "-"}</strong>
    </div>
  );
}
