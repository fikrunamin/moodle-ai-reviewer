import { useEffect, useState } from "react";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ActivitySidebar } from "./components/activity/ActivitySidebar";
import { StudentList } from "./components/student/StudentList";
import { AssessmentDetailPanel } from "./components/assessment/AssessmentDetailPanel";
import { AISettingsModal } from "./components/settings/AISettingsModal";
import { apiGet } from "./api/client";

interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
  last_synced_at: string | null;
  sync_error: string | null;
}

export function App() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshActivities = () => {
    apiGet<Activity[]>("/api/activities").then(setActivities).catch(() => setActivities([]));
  };

  useEffect(() => {
    refreshActivities();
  }, []);

  const selectedActivity = activities.find((activity) => activity.id === selectedActivityId) ?? null;

  return (
    <>
      <ThreePaneLayout
        left={
          <ActivitySidebar
            activities={activities}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => {
              setSelectedActivityId(id);
              setSelectedStudentId(null);
            }}
            onRefresh={refreshActivities}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }
        center={
          <StudentList
            activityId={selectedActivityId}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
          />
        }
        right={<AssessmentDetailPanel studentId={selectedStudentId} activityType={selectedActivity?.type ?? null} />}
      />
      {settingsOpen ? <AISettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}
