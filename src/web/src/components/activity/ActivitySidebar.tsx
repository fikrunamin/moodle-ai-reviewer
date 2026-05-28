import { Plus, Settings } from "lucide-react";
import { ActivityCard } from "./ActivityCard";

interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
}

interface Props {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
}

export function ActivitySidebar({ activities, selectedActivityId, onSelectActivity }: Props) {
  return (
    <div className="sidebar">
      <div className="toolbar">
        <h1>Moodle Review</h1>
        <div className="toolbar-actions">
          <button className="icon-button" aria-label="Add activity">
            <Plus size={18} />
          </button>
          <button className="icon-button" aria-label="AI settings">
            <Settings size={18} />
          </button>
        </div>
      </div>
      <div className="activity-list">
        {activities.length === 0 ? (
          <p className="empty-state">Belum ada activity.</p>
        ) : (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              active={activity.id === selectedActivityId}
              onClick={() => onSelectActivity(activity.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
