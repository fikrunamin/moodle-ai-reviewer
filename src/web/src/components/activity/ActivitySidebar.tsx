import { useEffect, useState } from "react";
import { ActivityCard } from "./ActivityCard";
import { AddActivityModal } from "./AddActivityModal";
import { EditRubricModal } from "./EditRubricModal";
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
}

export function ActivitySidebar({
  activities,
  selectedActivityId,
  onSelectActivity,
  onRefresh,
  onAddOptimistic,
  onOpenSettings,
}: Props) {
  const [filter, setFilter] = useState<"all" | "assignment" | "discussion">("all");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Activity | null>(null);
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

  return (
    <div className="win-window flex h-full flex-col">
      <div className="win-titlebar">
        <span className="text-[13px] font-semibold tracking-tight">Moodle Review</span>
        <div className="flex gap-1">
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

        <button
          className="win-button win-button-primary w-full"
          disabled={!selectedActivityId || busy}
          onClick={syncSelected}
        >
          {hasSyncingActivity || syncStatus?.pending ? "Syncing…" : "Sync selected"}
        </button>

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

      <div className="win-scroll mx-2 mb-2 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 text-[11.5px] text-muted">Belum ada activity.</p>
        ) : (
          filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              active={activity.id === selectedActivityId}
              onClick={() => onSelectActivity(activity.id)}
              onEditRubric={() => setEditingRubric(activity)}
            />
          ))
        )}
      </div>
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
    </div>
  );
}
