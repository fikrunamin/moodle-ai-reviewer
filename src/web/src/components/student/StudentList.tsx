import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { StudentItem } from "./StudentItem";
import { BulkActionBar } from "./BulkActionBar";

interface Student {
  id: string;
  student_name: string;
  ai_status: string;
  recommended_score: number | null;
  submission_status: string | null;
  interaction_count: number;
}

interface Props {
  activityId: string | null;
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
}

export function StudentList({ activityId, selectedStudentId, onSelectStudent }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const refresh = () => {
    if (!activityId) {
      setStudents([]);
      return;
    }
    apiGet<Student[]>(`/api/activities/${activityId}/students`).then(setStudents).catch(() => setStudents([]));
  };

  useEffect(() => {
    setSelectedIds([]);
    refresh();
  }, [activityId]);

  const filtered = students.filter((student) => {
    const matchesSearch = student.student_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || student.ai_status === status;
    return matchesSearch && matchesStatus;
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));

  async function generate(ids: string[], mode: "selected" | "missing" = "selected") {
    if (ids.length === 0) return;
    await apiPost("/api/assessments/generate-bulk", { studentIds: ids, mode });
    setTimeout(refresh, 800);
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">Mahasiswa</h2>
        <p className="text-xs text-slate-500">{students.length} student records</p>
      </div>
      <div className="grid gap-2 xl:grid-cols-[1fr_160px]">
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search mahasiswa" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="rounded-md border border-slate-300 px-2 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All AI Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={(event) =>
            setSelectedIds(event.target.checked ? Array.from(new Set([...selectedIds, ...filtered.map((student) => student.id)])) : selectedIds.filter((id) => !filtered.some((student) => student.id === id)))
          }
        />
        Select all visible
      </label>
      <BulkActionBar
        disabled={!activityId || selectedIds.length === 0}
        missingDisabled={!activityId || students.length === 0}
        onGenerateSelected={() => generate(selectedIds)}
        onGenerateMissing={() => generate(students.map((student) => student.id), "missing")}
        onRegenerateSelected={() => generate(selectedIds)}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Pilih activity untuk melihat mahasiswa.</p>
      ) : (
        filtered.map((student) => (
          <StudentItem
            key={student.id}
            student={student}
            active={student.id === selectedStudentId}
            checked={selectedIds.includes(student.id)}
            onCheckedChange={(checked) =>
              setSelectedIds((current) => (checked ? Array.from(new Set([...current, student.id])) : current.filter((id) => id !== student.id)))
            }
            onClick={() => onSelectStudent(student.id)}
          />
        ))
      )}
      </div>
    </div>
  );
}
