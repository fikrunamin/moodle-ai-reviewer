interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
  last_synced_at: string | null;
  sync_error: string | null;
  rubric_status: string;
  rubric_error: string | null;
}

interface Props {
  activity: Activity;
  active: boolean;
  onClick: () => void;
  onEditRubric: () => void;
}

export function ActivityCard({ activity, active, onClick, onEditRubric }: Props) {
  return (
    <div className={`grid w-full gap-1 p-1 text-left ${active ? "win-button active" : "win-button"}`}>
      <button className="grid gap-1 text-left" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <span className="capitalize">{activity.type === "assignment" ? "📝" : "💬"} {activity.type}</span>
        <span className="capitalize">{activity.sync_status === "failed" ? "❌" : activity.sync_status === "synced" ? "✅" : activity.sync_status === "syncing" ? "⏳" : "▫️"} {activity.sync_status}</span>
      </div>
      <strong className="line-clamp-2">{activity.title}</strong>
      <span>Last sync: {activity.last_synced_at ?? "-"}</span>
      <span>Rubrik: {activity.rubric_status === "processing" ? "⏳" : activity.rubric_status === "ready" ? "✅" : activity.rubric_status === "failed" ? "❌" : "▫️"} {activity.rubric_status}</span>
      {activity.sync_error ? <span>❌ {activity.sync_error}</span> : null}
      {activity.rubric_error ? <span>⚠️ {activity.rubric_error}</span> : null}
      </button>
      <button className="win-button" onClick={onEditRubric}>📄 Edit Rubrik</button>
    </div>
  );
}
