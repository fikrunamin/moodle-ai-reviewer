interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
}

interface Props {
  activity: Activity;
  active: boolean;
  onClick: () => void;
}

export function ActivityCard({ activity, active, onClick }: Props) {
  return (
    <button className={`activity-card ${active ? "active" : ""}`} onClick={onClick}>
      <span className="activity-type">{activity.type}</span>
      <strong>{activity.title}</strong>
      <span className="status">{activity.sync_status}</span>
    </button>
  );
}
