import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/client";
import { ModalPortal } from "../layout/ModalPortal";

interface Props {
  onClose: () => void;
}

export function AISettingsModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"ai" | "moodle" | "update">("ai");
  const [providerName, setProviderName] = useState("OpenAI");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [status, setStatus] = useState<string | null>(null);
  const [moodleBaseUrl, setMoodleBaseUrl] = useState("");
  const [cookies, setCookies] = useState("");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    repository: string;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseName: string;
    releaseUrl: string;
    publishedAt: string | null;
    recommendedAsset: { name: string; url: string; size: number } | null;
  } | null>(null);

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
    setStatus("Testing…");
    try {
      await apiPost("/api/ai-settings/test", payload);
      setStatus("Connection OK");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    }
  }

  async function save() {
    setStatus("Saving…");
    await apiPost("/api/ai-settings", payload);
    setApiKey("");
    setStatus("Saved");
  }

  async function saveCookies() {
    if (!moodleBaseUrl || !cookies) return;
    setBusy(true);
    setSessionStatus("Saving cookies…");
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
    setSessionStatus("Testing session…");
    try {
      const result = await apiPost<{ ok: boolean; cookie_count: number; login_required: boolean }>(
        "/api/moodle/cookies/test",
        {
          baseUrl: moodleBaseUrl,
          cookies: cookies.trim() || undefined,
        },
      );
      setSessionStatus(
        result.ok
          ? `Session OK (${result.cookie_count} cookies)`
          : "Session belum valid atau diarahkan ke login",
      );
    } catch (error) {
      setSessionStatus(error instanceof Error ? error.message : "Failed to test session");
    } finally {
      setBusy(false);
    }
  }

  async function checkUpdate() {
    setBusy(true);
    setUpdateStatus("Checking update…");
    try {
      const result = await apiGet<typeof updateInfo>("/api/update/check");
      setUpdateInfo(result);
      setUpdateStatus(result?.updateAvailable ? "Update tersedia" : "Sudah versi terbaru");
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Update check failed");
    } finally {
      setBusy(false);
    }
  }

  async function openLatestRelease() {
    setBusy(true);
    setUpdateStatus("Opening release page…");
    try {
      const result = await apiPost<typeof updateInfo>("/api/update/open-latest");
      setUpdateInfo(result);
      setUpdateStatus("Release page opened");
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Failed to open release page");
    } finally {
      setBusy(false);
    }
  }

  async function applyUpdate() {
    setBusy(true);
    setUpdateStatus("Downloading update…");
    try {
      const result = await apiPost<typeof updateInfo & { message?: string }>("/api/update/apply");
      setUpdateInfo(result);
      setUpdateStatus(result?.message ?? "Update downloaded. App will restart.");
    } catch (error) {
      setUpdateStatus(error instanceof Error ? error.message : "Failed to apply update");
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="win-modal w-full max-w-3xl">
        <div className="win-titlebar">
          <h2 className="text-[13px] font-semibold">Settings</h2>
          <button className="win-button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="grid min-h-[460px] grid-cols-[180px_1fr]">
          <aside className="grid content-start gap-1 border-r divider p-2">
            <button
              className={`win-tab w-full ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              AI Provider
            </button>
            <button
              className={`win-tab w-full ${activeTab === "moodle" ? "active" : ""}`}
              onClick={() => setActiveTab("moodle")}
            >
              Moodle Cookies
            </button>
            <button
              className={`win-tab w-full ${activeTab === "update" ? "active" : ""}`}
              onClick={() => setActiveTab("update")}
            >
              Update
            </button>
          </aside>

          <section className="flex flex-col">
            {activeTab === "ai" ? (
              <>
                <div className="grid gap-3 p-3">
                  <label className="win-field">
                    Provider Name
                    <input
                      className="win-input"
                      value={providerName}
                      onChange={(event) => setProviderName(event.target.value)}
                    />
                  </label>
                  <label className="win-field">
                    Base URL
                    <input
                      className="win-input"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                    />
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
                    <span className="text-[11px] text-muted">
                      Disimpan lokal sebagai plain text di SQLite.
                    </span>
                  </label>
                  <label className="win-field">
                    Model Name
                    <input
                      className="win-input"
                      value={modelName}
                      onChange={(event) => setModelName(event.target.value)}
                    />
                  </label>
                  {status ? <p className="win-status">{status}</p> : null}
                </div>
                <div className="mt-auto flex justify-end gap-1 border-t divider p-3">
                  <button className="win-button" onClick={testConnection}>
                    Test connection
                  </button>
                  <button className="win-button win-button-primary" onClick={save}>
                    Save
                  </button>
                </div>
              </>
            ) : activeTab === "moodle" ? (
              <>
                <div className="grid gap-3 p-3">
                  <div>
                    <h3 className="text-[12.5px] font-semibold">Moodle Session Cookies</h3>
                    <p className="text-[11.5px] text-muted">
                      Paste Cookie-Editor JSON export atau raw Cookie header dari domain Moodle.
                    </p>
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
                      placeholder='Paste Cookie-Editor JSON export, JSON cookies array, or raw Cookie header'
                      value={cookies}
                      onChange={(event) => setCookies(event.target.value)}
                    />
                  </label>
                  {sessionStatus ? <p className="win-status">{sessionStatus}</p> : null}
                </div>
                <div className="mt-auto flex justify-end gap-1 border-t divider p-3">
                  <button
                    className="win-button"
                    disabled={busy || !moodleBaseUrl}
                    onClick={testCookies}
                  >
                    Test session
                  </button>
                  <button
                    className="win-button win-button-primary"
                    disabled={busy || !moodleBaseUrl || !cookies}
                    onClick={saveCookies}
                  >
                    Save cookies
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 p-3">
                  <div>
                    <h3 className="text-[12.5px] font-semibold">Application Update</h3>
                    <p className="text-[11.5px] text-muted">
                      Cek release terbaru dari GitHub dan download paket terbaru.
                    </p>
                  </div>
                  {updateInfo ? (
                    <div className="win-inset grid gap-1 p-3 text-[12px]">
                      <p className="text-muted">Repo</p>
                      <p className="font-mono">{updateInfo.repository}</p>
                      <div className="flex gap-6 pt-1">
                        <div>
                          <p className="text-muted">Current</p>
                          <p>v{updateInfo.currentVersion}</p>
                        </div>
                        <div>
                          <p className="text-muted">Latest</p>
                          <p>v{updateInfo.latestVersion}</p>
                        </div>
                        <div>
                          <p className="text-muted">Status</p>
                          <p className={updateInfo.updateAvailable ? "text-warn" : "text-success"}>
                            {updateInfo.updateAvailable ? "Tersedia" : "Terbaru"}
                          </p>
                        </div>
                      </div>
                      {updateInfo.recommendedAsset ? (
                        <p className="pt-1 text-muted">Asset: {updateInfo.recommendedAsset.name}</p>
                      ) : (
                        <p className="pt-1 text-muted">Asset: belum ada downloadable.</p>
                      )}
                    </div>
                  ) : (
                    <div className="win-inset p-3 text-muted">Belum dicek.</div>
                  )}
                  {updateStatus ? <p className="win-status">{updateStatus}</p> : null}
                </div>
                <div className="mt-auto flex flex-wrap justify-end gap-1 border-t divider p-3">
                  {updateInfo?.recommendedAsset ? (
                    <a
                      className="win-button"
                      href={updateInfo.recommendedAsset.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download asset
                    </a>
                  ) : null}
                  {updateInfo ? (
                    <a
                      className="win-button"
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Release page
                    </a>
                  ) : null}
                  <button className="win-button" disabled={busy} onClick={openLatestRelease}>
                    Open latest
                  </button>
                  <button
                    className="win-button"
                    disabled={busy || !updateInfo?.updateAvailable || !updateInfo?.recommendedAsset}
                    onClick={applyUpdate}
                  >
                    Self update
                  </button>
                  <button
                    className="win-button win-button-primary"
                    disabled={busy}
                    onClick={checkUpdate}
                  >
                    Check update
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
