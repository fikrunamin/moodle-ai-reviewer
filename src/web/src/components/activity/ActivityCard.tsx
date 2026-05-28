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
    <button className={`grid w-full gap-2 rounded-md border p-3 text-left text-sm ${active ? "border-teal-700 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`} onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{activity.type}</span>
        <span className={`text-xs capitalize ${activity.sync_status === "failed" ? "text-red-700" : "text-slate-500"}`}>{activity.sync_status}</span>
      </div>
      <strong className="line-clamp-2">{activity.title}</strong>
      <span className="text-xs text-slate-500">Last sync: {activity.last_synced_at ?? "-"}</span>
      {activity.sync_error ? <span className="text-xs text-red-700">{activity.sync_error}</span> : null}
    </button>
  );
}
