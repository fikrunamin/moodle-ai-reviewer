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

const SYNC_TONE: Record<string, string> = {
  failed: "text-danger",
  synced: "text-success",
  syncing: "text-warn",
  idle: "text-muted",
};

const RUBRIC_TONE: Record<string, string> = {
  ready: "text-success",
  processing: "text-warn",
  failed: "text-danger",
  none: "text-muted",
};

export function ActivityCard({ activity, active, onClick, onEditRubric }: Props) {
  const syncTone = SYNC_TONE[activity.sync_status] ?? "text-muted";
  const rubricTone = RUBRIC_TONE[activity.rubric_status] ?? "text-muted";

  return (
    <div
      className={`win-inset grid w-full gap-1.5 p-2 text-left transition-colors ${
        active ? "border-[var(--accent-strong)] bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
      }`}
    >
      <button className="grid gap-1 text-left" onClick={onClick}>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="capitalize text-secondary">{activity.type}</span>
          <span className={`capitalize ${syncTone}`}>· {activity.sync_status}</span>
        </div>
        <strong className="line-clamp-2 text-[12.5px] leading-snug">{activity.title}</strong>
        <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted">
          <span className="truncate">Sync: {activity.last_synced_at ?? "-"}</span>
          <span className={rubricTone}>Rubrik: {activity.rubric_status}</span>
        </div>
        {activity.sync_error ? (
          <span className="text-[10.5px] text-danger">{activity.sync_error}</span>
        ) : null}
        {activity.rubric_error ? (
          <span className="text-[10.5px] text-warn">{activity.rubric_error}</span>
        ) : null}
      </button>
      <button className="win-button" onClick={onEditRubric}>
        Edit rubrik
      </button>
    </div>
  );
}
