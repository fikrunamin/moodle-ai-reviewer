import { useEffect, useState } from "react";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ActivitySidebar } from "./components/activity/ActivitySidebar";
import { StudentList } from "./components/student/StudentList";
import { AssessmentDetailPanel } from "./components/assessment/AssessmentDetailPanel";
import { AISettingsModal } from "./components/settings/AISettingsModal";
import { apiGet, apiPost } from "./api/client";

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

export function App() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [centerCollapsed, setCenterCollapsed] = useState(false);

  const refreshActivities = () => {
    apiGet<Activity[]>("/api/activities").then(setActivities).catch(() => setActivities([]));
  };

  useEffect(() => {
    refreshActivities();
  }, []);

  const deleteActivities = async (ids: string[]) => {
    if (ids.length === 0) return;
    await apiPost("/api/activities/delete-bulk", { activityIds: ids });
    if (selectedActivityId && ids.includes(selectedActivityId)) {
      setSelectedActivityId(null);
      setSelectedStudentId(null);
    }
    refreshActivities();
  };

  const selectedActivity = activities.find((activity) => activity.id === selectedActivityId) ?? null;

  return (
    <>
      <ThreePaneLayout
        leftCollapsed={leftCollapsed}
        centerCollapsed={centerCollapsed}
        onToggleLeft={() => setLeftCollapsed((current) => !current)}
        onToggleCenter={() => setCenterCollapsed((current) => !current)}
        left={
          <ActivitySidebar
            activities={activities}
            selectedActivityId={selectedActivityId}
            onSelectActivity={(id) => {
              setSelectedActivityId(id);
              setSelectedStudentId(null);
            }}
            onRefresh={refreshActivities}
            onAddOptimistic={(activity) => {
              setActivities((current) => [activity, ...current.filter((item) => item.id !== activity.id)]);
              setSelectedActivityId(activity.id);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onDeleteActivities={deleteActivities}
            onCollapse={() => setLeftCollapsed(true)}
          />
        }
        center={
          <StudentList
            activityId={selectedActivityId}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
            onStudentsDeleted={(ids) => {
              if (selectedStudentId && ids.includes(selectedStudentId)) setSelectedStudentId(null);
            }}
            onCollapse={() => setCenterCollapsed(true)}
          />
        }
        right={<AssessmentDetailPanel studentId={selectedStudentId} activityType={selectedActivity?.type ?? null} />}
      />
      {settingsOpen ? <AISettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}
