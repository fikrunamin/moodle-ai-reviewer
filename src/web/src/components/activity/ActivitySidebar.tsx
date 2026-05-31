import { useEffect, useState } from "react";
import { ActivityCard } from "./ActivityCard";
import { AddActivityModal } from "./AddActivityModal";
import { EditRubricModal } from "./EditRubricModal";
import { ConfirmDialog } from "../layout/ConfirmDialog";
import { apiGet, apiPost } from "../../api/client";

interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
  last_synced_at: string | null;
  sync_error: string | null;
  rubric_status: string;
  rubric_error: string | null;
  rubric_extracted_text: string | null;
  rubric_ai_json: string | null;
}

interface Props {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  onRefresh: () => void;
  onAddOptimistic: (activity: Activity) => void;
  onOpenSettings: () => void;
  onDeleteActivities: (ids: string[]) => Promise<void>;
  onCollapse?: () => void;
}

export function ActivitySidebar({
  activities,
  selectedActivityId,
  onSelectActivity,
  onRefresh,
  onAddOptimistic,
  onOpenSettings,
  onDeleteActivities,
  onCollapse,
}: Props) {
  const [filter, setFilter] = useState<"all" | "assignment" | "discussion">("all");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Activity | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ running: boolean; queued: number; pending: number } | null>(null);
  const [rubricStatus, setRubricStatus] = useState<{ running: boolean; queued: number; pending: number } | null>(null);
  const filtered = filter === "all" ? activities : activities.filter((activity) => activity.type === filter);
  const hasSyncingActivity = activities.some((activity) => activity.sync_status === "syncing");
  const hasProcessingRubric = activities.some((activity) => activity.rubric_status === "processing");

  useEffect(() => {
    if (!hasSyncingActivity && !syncStatus?.pending) return;
    const timer = window.setInterval(() => {
      apiGet<{ running: boolean; queued: number; pending: number }>("/api/jobs/sync")
        .then(setSyncStatus)
        .catch(() => null);
      onRefresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasSyncingActivity, syncStatus?.pending, onRefresh]);

  useEffect(() => {
    if (!hasProcessingRubric && !rubricStatus?.pending) return;
    const timer = window.setInterval(() => {
      apiGet<{ running: boolean; queued: number; pending: number }>("/api/jobs/rubric")
        .then(setRubricStatus)
        .catch(() => null);
      onRefresh();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasProcessingRubric, rubricStatus?.pending, onRefresh]);

  async function syncSelected() {
    if (!selectedActivityId) return;
    setBusy(true);
    try {
      const result = await apiPost<{ queue: { running: boolean; queued: number; pending: number } }>(
        `/api/activities/${selectedActivityId}/sync`,
      );
      setSyncStatus(result.queue);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleSelectMode() {
    setSelectMode((current) => {
      if (current) setSelectedIds([]);
      return !current;
    });
  }

  function toggleId(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((activity) => selectedIds.includes(activity.id));

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDeleteActivities(selectedIds);
      setSelectedIds([]);
      setSelectMode(false);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="win-window relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="win-titlebar sticky top-0 z-10">
        <span className="text-[13px] font-semibold tracking-tight">Moodle Review</span>
        <div className="flex gap-1">
          {onCollapse ? (
            <button className="win-button" onClick={onCollapse} aria-label="Collapse activity pane" title="Collapse pane">
              &lt;
            </button>
          ) : null}
          <button
            className={`win-button ${selectMode ? "active" : ""}`}
            onClick={toggleSelectMode}
            aria-label="Select activities"
            title="Pilih untuk hapus"
            disabled={activities.length === 0}
          >
            {selectMode ? "Batal" : "Pilih"}
          </button>
          <button
            className="win-button"
            onClick={() => setAddOpen(true)}
            aria-label="Add activity"
            title="Add activity"
          >
            +
          </button>
          <button
            className="win-button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      <div className="grid gap-2 p-2">
        <div className="flex gap-1">
          {(["all", "assignment", "discussion"] as const).map((item) => (
            <button
              key={item}
              className={`win-button flex-1 capitalize ${filter === item ? "active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {selectMode ? (
          <label className="flex items-center gap-2 text-[11.5px] text-secondary">
            <input
              type="checkbox"
              className="accent-[var(--accent-strong)]"
              checked={allVisibleSelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked
                    ? Array.from(new Set([...selectedIds, ...filtered.map((a) => a.id)]))
                    : selectedIds.filter((id) => !filtered.some((a) => a.id === id)),
                )
              }
            />
            Select all visible ({filtered.length})
          </label>
        ) : (
          <button
            className="win-button win-button-primary w-full"
            disabled={!selectedActivityId || busy}
            onClick={syncSelected}
          >
            {hasSyncingActivity || syncStatus?.pending ? "Syncing…" : "Sync selected"}
          </button>
        )}

        {hasSyncingActivity || syncStatus?.pending ? (
          <p className="win-status">
            Sync · queued {syncStatus?.queued ?? 0} · pending {syncStatus?.pending ?? 0}
          </p>
        ) : null}
        {hasProcessingRubric || rubricStatus?.pending ? (
          <p className="win-status">
            Rubrik · queued {rubricStatus?.queued ?? 0} · pending {rubricStatus?.pending ?? 0}
          </p>
        ) : null}
      </div>

      <div className={`win-scroll mx-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto ${selectMode ? "mb-16" : "mb-2"}`}>
        {filtered.length === 0 ? (
          <p className="px-1 text-[11.5px] text-muted">Belum ada activity.</p>
        ) : (
          filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              active={activity.id === selectedActivityId}
              selectMode={selectMode}
              checked={selectedIds.includes(activity.id)}
              onCheckedChange={(checked) => toggleId(activity.id, checked)}
              onClick={() => onSelectActivity(activity.id)}
              onEditRubric={() => setEditingRubric(activity)}
            />
          ))
        )}
      </div>

      {selectMode && selectedIds.length > 0 ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t divider bg-[var(--bg-surface)]/95 p-2 backdrop-blur">
          <span className="text-[12px] text-secondary">{selectedIds.length} dipilih</span>
          <button
            className="win-button"
            style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#1a0b0b" }}
            onClick={() => setConfirmOpen(true)}
          >
            Hapus {selectedIds.length} activity
          </button>
        </div>
      ) : null}

      {addOpen ? (
        <AddActivityModal
          onClose={() => setAddOpen(false)}
          onCreated={onRefresh}
          onCreatedActivity={onAddOptimistic}
        />
      ) : null}
      {editingRubric ? (
        <EditRubricModal
          activity={editingRubric}
          onClose={() => setEditingRubric(null)}
          onUpdated={onRefresh}
        />
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus activity"
        message={`Hapus ${selectedIds.length} activity beserta seluruh data mahasiswa, submission, dan review-nya dari aplikasi ini? Tindakan ini tidak menyentuh Moodle dan tidak bisa dibatalkan.`}
        confirmLabel={`Hapus ${selectedIds.length}`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
