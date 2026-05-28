import { useState } from "react";
import { Plus, RefreshCw, Settings } from "lucide-react";
import { ActivityCard } from "./ActivityCard";
import { apiPost } from "../../api/client";

interface Activity {
  id: string;
  title: string;
  type: "assignment" | "discussion";
  sync_status: string;
  last_synced_at: string | null;
  sync_error: string | null;
}

interface Props {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function ActivitySidebar({ activities, selectedActivityId, onSelectActivity, onRefresh, onOpenSettings }: Props) {
  const [filter, setFilter] = useState<"all" | "assignment" | "discussion">("all");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"assignment" | "discussion">("assignment");
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [cookies, setCookies] = useState("");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const filtered = filter === "all" ? activities : activities.filter((activity) => activity.type === filter);

  async function addActivity() {
    if (!title.trim() || !url.trim()) return;
    setBusy(true);
    try {
      await apiPost("/api/activities", { title, url, type });
      setTitle("");
      setUrl("");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function syncSelected() {
    if (!selectedActivityId) return;
    setBusy(true);
    try {
      await apiPost(`/api/activities/${selectedActivityId}/sync`);
      setTimeout(onRefresh, 500);
    } finally {
      setBusy(false);
    }
  }

  async function saveCookies() {
    if (!baseUrl || !cookies) return;
    setBusy(true);
    setSessionStatus("Saving cookies...");
    try {
      const result = await apiPost<{ count: number }>("/api/moodle/cookies", { baseUrl, cookies });
      setCookies("");
      setSessionStatus(`Saved ${result.count} cookies`);
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : "Failed to save cookies");
    } finally {
      setBusy(false);
    }
  }

  async function testCookies() {
    if (!baseUrl) return;
    setBusy(true);
    setSessionStatus("Testing session...");
    try {
      const result = await apiPost<{ ok: boolean; cookie_count: number; login_required: boolean }>("/api/moodle/cookies/test", {
        baseUrl,
        cookies: cookies.trim() || undefined,
      });
      setSessionStatus(result.ok ? `Session OK (${result.cookie_count} cookies)` : "Session belum valid atau masih diarahkan ke login");
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : "Failed to test session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Moodle Review</h1>
          <p className="text-xs text-slate-500">Read-only local assistant</p>
        </div>
        <div className="flex gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 hover:bg-slate-50" onClick={onOpenSettings} aria-label="AI settings">
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600">Moodle Session Cookies</p>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Moodle base URL, e.g. https://moodle.example.ac.id" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        <textarea
          className="min-h-24 resize-y rounded-md border border-slate-300 px-3 py-2 text-xs leading-5"
          placeholder='Paste raw Cookie header: MoodleSession=...; MOODLEID1_=... or cookies JSON array'
          value={cookies}
          onChange={(event) => setCookies(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={busy || !baseUrl || !cookies} onClick={saveCookies}>
            Save Cookies
          </button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={busy || !baseUrl} onClick={testCookies}>
            Test Session
          </button>
        </div>
        {sessionStatus ? <p className="text-xs text-slate-600">{sessionStatus}</p> : null}
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600">Add Activity URL</p>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Activity title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Moodle activity URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <div className="flex gap-2">
          <select className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value as "assignment" | "discussion")}>
            <option value="assignment">Assignment</option>
            <option value="discussion">Discussion</option>
          </select>
          <button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={addActivity}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "assignment", "discussion"] as const).map((item) => (
          <button key={item} className={`rounded-md border px-3 py-1.5 text-sm capitalize ${filter === item ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-300"}`} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={!selectedActivityId || busy} onClick={syncSelected}>
        <RefreshCw size={16} /> Sync Selected
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada activity.</p>
        ) : (
          filtered.map((activity) => (
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
