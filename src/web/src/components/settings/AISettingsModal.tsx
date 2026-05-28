import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";

interface Props {
  onClose: () => void;
}

export function AISettingsModal({ onClose }: Props) {
  const [providerName, setProviderName] = useState("OpenAI");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{
      provider_name: string;
      base_url: string;
      api_key_encrypted: string | null;
      model_name: string;
    } | null>("/api/ai-settings/active")
      .then((setting) => {
        if (!setting) return;
        setProviderName(setting.provider_name);
        setBaseUrl(setting.base_url);
        setApiKey(setting.api_key_encrypted ?? "");
        setModelName(setting.model_name);
      })
      .catch(() => null);
  }, []);

  const payload = { providerName, baseUrl, apiKey, modelName };

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
    setApiKey("********");
    setStatus("Saved");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="font-semibold">AI Settings</h2>
          <button className="grid h-8 w-8 place-items-center rounded-md border border-slate-300" onClick={onClose} aria-label="Close settings">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-3 p-4">
          <label className="grid gap-1 text-sm">
            Provider Name
            <input className="rounded-md border border-slate-300 px-3 py-2" value={providerName} onChange={(event) => setProviderName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Base URL
            <input className="rounded-md border border-slate-300 px-3 py-2" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            API Key
            <input className="rounded-md border border-slate-300 px-3 py-2" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Model Name
            <input className="rounded-md border border-slate-300 px-3 py-2" value={modelName} onChange={(event) => setModelName(event.target.value)} />
          </label>
          {status ? <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">{status}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" onClick={testConnection}>Test Connection</button>
          <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
