import { useState } from "react";
import { apiPostForm } from "../../api/client";

interface Activity {
  id: string;
  title: string;
  rubric_extracted_text: string | null;
  rubric_ai_json: string | null;
}

interface Props {
  activity: Activity;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditRubricModal({ activity, onClose, onUpdated }: Props) {
  const [rubricText, setRubricText] = useState(activity.rubric_ai_json || activity.rubric_extracted_text || "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveText() {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("rubricText", rubricText);
      await apiPostForm(`/api/activities/${activity.id}/rubric`, form);
      setMessage("Rubrik text saved.");
      onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save rubric");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("rubricFile", file);
      await apiPostForm(`/api/activities/${activity.id}/rubric`, form);
      setMessage("Rubrik upload queued.");
      onUpdated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload rubric");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="win-modal w-full max-w-3xl">
        <div className="win-titlebar">
          <h2>Edit Rubrik</h2>
          <button className="win-button" onClick={onClose}>❌</button>
        </div>
        <div className="grid gap-2 p-2">
          <p className="win-status">{activity.title}</p>
          <label className="win-field">
            Upload PDF baru
            <input className="win-input" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end">
            <button className="win-button" disabled={busy || !file} onClick={uploadFile}>📄 Upload & Process Background</button>
          </div>
          <label className="win-field">
            Edit Rubrik Manual
            <textarea className="win-textarea min-h-72 resize-y font-mono" value={rubricText} onChange={(event) => setRubricText(event.target.value)} />
          </label>
          {message ? <p className="win-status">{message}</p> : null}
        </div>
        <div className="flex justify-end gap-1 p-2">
          <button className="win-button" onClick={onClose}>Close</button>
          <button className="win-button" disabled={busy || !rubricText.trim()} onClick={saveText}>💾 Save Text</button>
        </div>
      </div>
    </div>
  );
}
