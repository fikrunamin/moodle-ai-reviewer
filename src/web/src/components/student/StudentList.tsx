import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import { StudentItem } from "./StudentItem";
import { BulkActionBar } from "./BulkActionBar";

interface Student {
  id: string;
  student_name: string;
  ai_status: string;
  recommended_score: number | null;
}

interface Props {
  activityId: string | null;
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
}

export function StudentList({ activityId, selectedStudentId, onSelectStudent }: Props) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (!activityId) {
      setStudents([]);
      return;
    }
    apiGet<Student[]>(`/api/activities/${activityId}/students`).then(setStudents).catch(() => setStudents([]));
  }, [activityId]);

  return (
    <div className="student-pane">
      <BulkActionBar disabled={!activityId || students.length === 0} />
      {students.length === 0 ? (
        <p className="empty-state">Pilih activity untuk melihat mahasiswa.</p>
      ) : (
        students.map((student) => (
          <StudentItem
            key={student.id}
            student={student}
            active={student.id === selectedStudentId}
            onClick={() => onSelectStudent(student.id)}
          />
        ))
      )}
    </div>
  );
}
