import { useState } from "react";
import { apiPost } from "../../api/client";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddActivityModal({ onClose, onCreated }: Props) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"assignment" | "discussion">("assignment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addActivity() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/activities", { url, type });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add activity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="win-modal w-full max-w-lg">
        <div className="win-titlebar">
          <h2 className="font-semibold">Add Activity</h2>
          <button className="win-button" onClick={onClose} aria-label="Close add activity">
            ❌
          </button>
        </div>
        <div className="grid gap-2 p-2">
          <label className="win-field">
            Moodle Activity URL
            <input className="win-input" placeholder="https://moodle.example.ac.id/mod/assign/view.php?id=..." value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>
          <label className="win-field">
            Activity Type
            <select className="win-select" value={type} onChange={(event) => setType(event.target.value as "assignment" | "discussion")}>
              <option value="assignment">Assignment</option>
              <option value="discussion">Discussion</option>
            </select>
          </label>
          {error ? <p className="win-status">❌ {error}</p> : null}
        </div>
        <div className="flex justify-end gap-1 p-2">
          <button className="win-button" onClick={onClose}>Cancel</button>
          <button className="win-button" disabled={busy || !url.trim()} onClick={addActivity}>
            ➕ Add Activity
          </button>
        </div>
      </div>
    </div>
  );
}
