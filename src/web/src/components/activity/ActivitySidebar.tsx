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

export function ActivitySidebar({ activities, selectedActivityId, onSelectActivity, onRefresh, onAddOptimistic, onOpenSettings }: Props) {
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
      const result = await apiPost<{ queue: { running: boolean; queued: number; pending: number } }>(`/api/activities/${selectedActivityId}/sync`);
      setSyncStatus(result.queue);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="win-window flex h-full flex-col">
      <div className="win-titlebar">
        <div>
          <span>Moodle Review</span>
        </div>
        <div className="flex gap-2">
          <button className="win-button" onClick={() => setAddOpen(true)} aria-label="Add activity">
            ➕
          </button>
          <button className="win-button" onClick={onOpenSettings} aria-label="Settings">
            ⚙️
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-2">
        {(["all", "assignment", "discussion"] as const).map((item) => (
          <button key={item} className={`win-button capitalize ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="px-2 pb-2">
        <button className="win-button w-full" disabled={!selectedActivityId || busy} onClick={syncSelected}>
          {hasSyncingActivity || syncStatus?.pending ? "⏳" : "🔄"} Sync Selected
        </button>
      </div>
      {hasSyncingActivity || syncStatus?.pending ? (
        <p className="win-status mx-2 mb-2">Sync running · queued {syncStatus?.queued ?? 0} · pending {syncStatus?.pending ?? 0}</p>
      ) : null}
      {hasProcessingRubric || rubricStatus?.pending ? (
        <p className="win-status mx-2 mb-2">Rubrik processing · queued {rubricStatus?.queued ?? 0} · pending {rubricStatus?.pending ?? 0}</p>
      ) : null}

      <div className="win-inset win-scroll mx-2 mb-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="p-1">Belum ada activity.</p>
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
      {addOpen ? <AddActivityModal onClose={() => setAddOpen(false)} onCreated={onRefresh} onCreatedActivity={onAddOptimistic} /> : null}
      {editingRubric ? <EditRubricModal activity={editingRubric} onClose={() => setEditingRubric(null)} onUpdated={onRefresh} /> : null}
    </div>
  );
}
