import { useEffect, useState } from "react";
import { ThreePaneLayout } from "./components/layout/ThreePaneLayout";
import { ActivitySidebar } from "./components/activity/ActivitySidebar";
import { StudentList } from "./components/student/StudentList";
import { AssessmentDetailPanel } from "./components/assessment/AssessmentDetailPanel";
import { apiGet } from "./api/client";

interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
}

export function App() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Activity[]>("/api/activities").then(setActivities).catch(() => setActivities([]));
  }, []);

  return (
    <ThreePaneLayout
      left={
        <ActivitySidebar
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={setSelectedActivityId}
        />
      }
      center={
        <StudentList
          activityId={selectedActivityId}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
        />
      }
      right={<AssessmentDetailPanel studentId={selectedStudentId} />}
    />
  );
}
