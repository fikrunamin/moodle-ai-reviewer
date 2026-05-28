interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
  last_synced_at: string | null;
  sync_error: string | null;
}

interface Props {
  activity: Activity;
  active: boolean;
  onClick: () => void;
}

export function ActivityCard({ activity, active, onClick }: Props) {
  return (
    <button className={`grid w-full gap-1 p-1 text-left ${active ? "win-button active" : "win-button"}`} onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <span className="capitalize">{activity.type === "assignment" ? "📝" : "💬"} {activity.type}</span>
        <span className="capitalize">{activity.sync_status === "failed" ? "❌" : activity.sync_status === "synced" ? "✅" : activity.sync_status === "syncing" ? "⏳" : "▫️"} {activity.sync_status}</span>
      </div>
      <strong className="line-clamp-2">{activity.title}</strong>
      <span>Last sync: {activity.last_synced_at ?? "-"}</span>
      {activity.sync_error ? <span>❌ {activity.sync_error}</span> : null}
    </button>
  );
}
