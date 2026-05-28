import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import { CopyFeedbackBox } from "./CopyFeedbackBox";

interface Assessment {
  summary: string;
  feedback: string;
  recommended_score: number;
  manual_review_required: number;
  manual_review_reason: string | null;
}

export function AssessmentDetailPanel({ studentId }: { studentId: string | null }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  useEffect(() => {
    if (!studentId) {
      setAssessment(null);
      return;
    }
    apiGet<Assessment | null>(`/api/students/${studentId}/assessment`)
      .then(setAssessment)
      .catch(() => setAssessment(null));
  }, [studentId]);

  if (!studentId) {
    return <p className="empty-state">Pilih mahasiswa untuk melihat review.</p>;
  }

  if (!assessment) {
    return <p className="empty-state">Belum ada assessment.</p>;
  }

  return (
    <div className="assessment-panel">
      <div className="score-header">
        <span>Recommended score</span>
        <strong>{assessment.recommended_score}</strong>
      </div>
      <p>{assessment.summary}</p>
      {assessment.manual_review_required ? (
        <p className="warning">{assessment.manual_review_reason ?? "Perlu review manual."}</p>
      ) : null}
      <CopyFeedbackBox feedback={assessment.feedback} />
    </div>
  );
}
