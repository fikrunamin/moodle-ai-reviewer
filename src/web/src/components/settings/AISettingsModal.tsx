import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";

interface Props {
  onClose: () => void;
}

export function AISettingsModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "moodle">("ai");
  const [providerName, setProviderName] = useState("OpenAI");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [status, setStatus] = useState<string | null>(null);
  const [moodleBaseUrl, setMoodleBaseUrl] = useState("");
  const [cookies, setCookies] = useState("");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{
      provider_name: string;
      base_url: string;
      api_key_encrypted: string | null;
      has_api_key?: boolean;
      model_name: string;
    } | null>("/api/ai-settings/active")
      .then((setting) => {
        if (!setting) return;
        setProviderName(setting.provider_name);
        setBaseUrl(setting.base_url);
        setApiKey("");
        setModelName(setting.model_name);
      })
      .catch(() => null);
  }, []);

  const payload = { providerName, baseUrl, apiKey: apiKey.trim() || undefined, modelName };

  async function testConnection() {
    setStatus("Testing...");
    try {
      await apiPost("/api/ai-settings/test", payload);
      setStatus("Connection OK");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    }
  }

  async function save() {
    setStatus("Saving...");
    await apiPost("/api/ai-settings", payload);
    setApiKey("");
    setStatus("Saved");
  }

  async function saveCookies() {
    if (!moodleBaseUrl || !cookies) return;
    setBusy(true);
    setSessionStatus("Saving cookies...");
    try {
      const result = await apiPost<{ count: number }>("/api/moodle/cookies", {
        baseUrl: moodleBaseUrl,
        cookies,
      });
      setCookies("");
      setSessionStatus(`Saved ${result.count} cookies`);
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : "Failed to save cookies");
    } finally {
      setBusy(false);
    }
  }

  async function testCookies() {
    if (!moodleBaseUrl) return;
    setBusy(true);
    setSessionStatus("Testing session...");
    try {
      const result = await apiPost<{ ok: boolean; cookie_count: number; login_required: boolean }>("/api/moodle/cookies/test", {
        baseUrl: moodleBaseUrl,
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="win-modal w-full max-w-3xl">
        <div className="win-titlebar">
          <h2 className="font-semibold">Settings</h2>
          <button className="win-button" onClick={onClose} aria-label="Close settings">
            ❌
          </button>
        </div>

        <div className="grid min-h-[460px] grid-cols-[180px_1fr]">
          <aside className="p-2">
            <button
              className={`win-tab w-full ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              🤖 AI Provider
            </button>
            <button
              className={`win-tab mt-1 w-full ${activeTab === "moodle" ? "active" : ""}`}
              onClick={() => setActiveTab("moodle")}
            >
              🍪 Moodle Cookies
            </button>
          </aside>

          <section className="win-inset m-2 flex flex-col">
            {activeTab === "ai" ? (
              <>
                <div className="grid gap-2 p-2">
                  <label className="win-field">
                    Provider Name
                    <input className="win-input" value={providerName} onChange={(event) => setProviderName(event.target.value)} />
                  </label>
                  <label className="win-field">
                    Base URL
                    <input className="win-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
                  </label>
                  <label className="win-field">
                    API Key
                    <input
                      className="win-input"
                      type="password"
                      placeholder="Leave blank to keep saved key"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                    />
                    <span className="text-xs text-slate-500">Stored locally as plain text in SQLite.</span>
                  </label>
                  <label className="win-field">
                    Model Name
                    <input className="win-input" value={modelName} onChange={(event) => setModelName(event.target.value)} />
                  </label>
                  {status ? <p className="win-status">{status}</p> : null}
                </div>
                <div className="mt-auto flex justify-end gap-1 p-2">
                  <button className="win-button" onClick={testConnection}>🔌 Test Connection</button>
                  <button className="win-button" onClick={save}>💾 Save</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2 p-2">
                  <div>
                    <h3 className="font-medium">Moodle Session Cookies</h3>
                    <p>Paste Cookie-Editor JSON export atau raw Cookie header dari domain Moodle.</p>
                  </div>
                  <label className="win-field">
                    Moodle Base URL
                    <input
                      className="win-input"
                      placeholder="https://moodle.example.ac.id"
                      value={moodleBaseUrl}
                      onChange={(event) => setMoodleBaseUrl(event.target.value)}
                    />
                  </label>
                  <label className="win-field">
                    Cookies JSON / Header
                    <textarea
                      className="win-textarea min-h-56 resize-y font-mono"
                      placeholder='Paste Cookie-Editor JSON export, JSON cookies array, or raw Cookie header: MoodleSession=...; MOODLEID1_=...'
                      value={cookies}
                      onChange={(event) => setCookies(event.target.value)}
                    />
                  </label>
                  {sessionStatus ? <p className="win-status">{sessionStatus}</p> : null}
                </div>
                <div className="mt-auto flex justify-end gap-1 p-2">
                  <button className="win-button" disabled={busy || !moodleBaseUrl} onClick={testCookies}>
                    🧪 Test Session
                  </button>
                  <button className="win-button" disabled={busy || !moodleBaseUrl || !cookies} onClick={saveCookies}>
                    💾 Save Cookies
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
