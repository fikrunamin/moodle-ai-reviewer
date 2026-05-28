interface Student {
  id: string;
  student_name: string;
  ai_status: string;
  recommended_score: number | null;
}

interface Props {
  student: Student;
  active: boolean;
  onClick: () => void;
}

export function StudentItem({ student, active, onClick }: Props) {
  return (
    <button className={`student-item ${active ? "active" : ""}`} onClick={onClick}>
      <span>{student.student_name}</span>
      <strong>{student.recommended_score ?? "-"}</strong>
      <small>{student.ai_status}</small>
    </button>
  );
}
