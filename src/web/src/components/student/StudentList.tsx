import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { StudentItem } from "./StudentItem";
import { BulkActionBar } from "./BulkActionBar";
import { ConfirmDialog } from "../layout/ConfirmDialog";

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
  onStudentsDeleted?: (ids: string[]) => void;
}

export function StudentList({ activityId, selectedStudentId, onSelectStudent, onStudentsDeleted }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [jobStatus, setJobStatus] = useState<{ running: boolean; queued: number; pending: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    if (!activityId) {
      setStudents([]);
      return;
    }
    apiGet<Student[]>(`/api/activities/${activityId}/students`)
      .then(setStudents)
      .catch(() => setStudents([]));
  };

  useEffect(() => {
    setSelectedIds([]);
    refresh();
  }, [activityId]);

  useEffect(() => {
    if (!jobStatus?.pending) return;
    const timer = window.setInterval(() => {
      apiGet<{ running: boolean; queued: number; pending: number }>("/api/jobs/ai")
        .then((next) => {
          setJobStatus(next);
          if (next.pending === 0) setMessage("Bulk generate selesai");
        })
        .catch(() => null);
      refresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [jobStatus?.pending, activityId]);

  const filtered = students.filter((student) => {
    const matchesSearch = student.student_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || student.ai_status === status;
    return matchesSearch && matchesStatus;
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));

  async function generate(ids: string[], mode: "selected" | "missing" = "selected") {
    if (ids.length === 0) return;
    setMessage("Bulk generate antri…");
    const result = await apiPost<{ queue: { running: boolean; queued: number; pending: number } }>(
      "/api/assessments/generate-bulk",
      { studentIds: ids, mode },
    );
    setJobStatus(result.queue);
    refresh();
  }

  async function confirmDelete() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await apiPost("/api/students/delete-bulk", { studentIds: selectedIds, activityId });
      onStudentsDeleted?.(selectedIds);
      setSelectedIds([]);
      setConfirmOpen(false);
      setMessage(`${selectedIds.length} mahasiswa dihapus dari aplikasi`);
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="win-window relative flex h-full flex-col">
      <div className="win-titlebar">
        <span className="text-[13px] font-semibold tracking-tight">Mahasiswa</span>
        <span className="text-[11px] text-muted">{students.length} records</span>
      </div>
      <div className="grid gap-2 p-2">
        <div className="grid gap-1 xl:grid-cols-[1fr_140px]">
          <input
            className="win-input"
            placeholder="Search mahasiswa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="win-select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[11.5px] text-secondary">
          <input
            type="checkbox"
            className="accent-[var(--accent-strong)]"
            checked={allVisibleSelected}
            onChange={(event) =>
              setSelectedIds(
                event.target.checked
                  ? Array.from(new Set([...selectedIds, ...filtered.map((student) => student.id)]))
                  : selectedIds.filter((id) => !filtered.some((student) => student.id === id)),
              )
            }
          />
          Select all visible ({filtered.length})
        </label>
        <BulkActionBar
          disabled={!activityId || selectedIds.length === 0 || Boolean(jobStatus?.pending)}
          missingDisabled={!activityId || students.length === 0 || Boolean(jobStatus?.pending)}
          onGenerateSelected={() => generate(selectedIds)}
          onGenerateMissing={() => generate(students.map((student) => student.id), "missing")}
          onRegenerateSelected={() => generate(selectedIds)}
        />
        {message || jobStatus?.pending ? (
          <p className="win-status">
            {message}
            {jobStatus?.pending
              ? ` · running ${jobStatus.running ? "yes" : "no"} · queued ${jobStatus.queued} · pending ${jobStatus.pending}`
              : ""}
          </p>
        ) : null}
      </div>
      <div className={`win-scroll mx-2 grid min-h-0 flex-1 content-start gap-1 overflow-y-auto ${selectedIds.length > 0 ? "mb-16" : "mb-2"}`}>
        {filtered.length === 0 ? (
          <p className="px-1 text-[11.5px] text-muted">Pilih activity untuk melihat mahasiswa.</p>
        ) : (
          filtered.map((student) => (
            <StudentItem
              key={student.id}
              student={student}
              active={student.id === selectedStudentId}
              checked={selectedIds.includes(student.id)}
              onCheckedChange={(checked) =>
                setSelectedIds((current) =>
                  checked
                    ? Array.from(new Set([...current, student.id]))
                    : current.filter((id) => id !== student.id),
                )
              }
              onClick={() => onSelectStudent(student.id)}
            />
          ))
        )}
      </div>

      {selectedIds.length > 0 ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t divider bg-[var(--bg-surface)]/95 p-2 backdrop-blur">
          <span className="text-[12px] text-secondary">{selectedIds.length} dipilih</span>
          <div className="flex gap-1">
            <button className="win-button" onClick={() => setSelectedIds([])}>
              Bersihkan
            </button>
            <button
              className="win-button"
              style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#1a0b0b" }}
              onClick={() => setConfirmOpen(true)}
            >
              Hapus {selectedIds.length}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Hapus mahasiswa"
        message={`Hapus ${selectedIds.length} mahasiswa beserta submission dan review-nya dari APLIKASI INI saja. Data di Moodle tidak tersentuh. Lanjutkan?`}
        confirmLabel={`Hapus ${selectedIds.length}`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
