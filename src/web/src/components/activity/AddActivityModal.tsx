import { useState } from "react";
import { apiPostForm } from "../../api/client";
import { ModalPortal } from "../layout/ModalPortal";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  onCreatedActivity: (activity: CreatedActivity) => void;
}

interface CreatedActivity {
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

export function AddActivityModal({ onClose, onCreated, onCreatedActivity }: Props) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"assignment" | "discussion">("assignment");
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addActivity() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("url", url);
      form.set("type", type);
      if (rubricFile) form.set("rubricFile", rubricFile);
      const created = await apiPostForm<CreatedActivity>("/api/activities", form);
      onCreatedActivity(created);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add activity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="win-modal w-full max-w-lg">
        <div className="win-titlebar">
          <h2 className="text-[13px] font-semibold">Add Activity</h2>
          <button className="win-button" onClick={onClose} aria-label="Close add activity">
            ✕
          </button>
        </div>
        <div className="grid gap-3 p-3">
          <label className="win-field">
            Moodle Activity URL
            <input
              className="win-input"
              placeholder="https://moodle.example.ac.id/mod/assign/view.php?id=..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <label className="win-field">
            Activity Type
            <select
              className="win-select"
              value={type}
              onChange={(event) => setType(event.target.value as "assignment" | "discussion")}
            >
              <option value="assignment">Assignment</option>
              <option value="discussion">Discussion</option>
            </select>
          </label>
          <label className="win-field">
            Rubrik PDF (opsional)
            <input
              className="win-input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setRubricFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {rubricFile ? (
            <p className="win-status">{rubricFile.name}</p>
          ) : (
            <p className="win-status text-muted">Jika kosong, rubrik default akan digunakan.</p>
          )}
          {error ? <p className="win-status text-danger">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-1 border-t divider p-3">
          <button className="win-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="win-button win-button-primary"
            disabled={busy || !url.trim()}
            onClick={addActivity}
          >
            {busy ? "Menambah…" : "Add Activity"}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
