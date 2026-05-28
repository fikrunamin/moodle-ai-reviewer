import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { paths } from "../runtime/paths";
import { appVersion } from "../shared/version";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  html_url: string;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  assets: GitHubReleaseAsset[];
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

function repoName() {
  return process.env.UPDATE_GITHUB_REPO?.trim() || "fikrunamin/moodle-ai-reviewer";
}

function openUrl(url: string) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" });
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function windowsUpdaterScript(input: { zipPath: string; appRoot: string; executablePath: string; processId: number; extractDir: string; logPath: string }) {
  return `@echo off
setlocal enabledelayedexpansion
set "ZIP=${input.zipPath}"
set "DEST=${input.appRoot}"
set "EXE=${input.executablePath}"
set "APP_PID=${input.processId}"
set "TMP=${input.extractDir}"
set "LOG=${input.logPath}"

echo [%date% %time%] Waiting for Moodle AI Review Assistant to close... > "%LOG%"
:wait
tasklist /FI "PID eq %APP_PID%" | findstr "%APP_PID%" >nul
if not errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

echo [%date% %time%] Extracting update... >> "%LOG%"
mkdir "%TMP%" >> "%LOG%" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:TMP -Force" >> "%LOG%" 2>&1
if errorlevel 1 goto failed

set "SRC="
for /d %%D in ("%TMP%\\*") do (
  set "SRC=%%~fD"
  goto copy
)
goto failed

:copy
echo [%date% %time%] Copying update from %SRC% to %DEST%... >> "%LOG%"
robocopy "%SRC%" "%DEST%" /E /XD "%SRC%\\data" /NFL /NDL /NJH /NJS /NP >> "%LOG%" 2>&1
if %ERRORLEVEL% GEQ 8 goto failed

echo [%date% %time%] Restarting app... >> "%LOG%"
start "" "%EXE%"
exit /b 0

:failed
echo [%date% %time%] Update failed. See log above. >> "%LOG%"
start "" "%DEST%"
exit /b 1
`;
}

function unixUpdaterScript(input: { zipPath: string; appRoot: string; executablePath: string; processId: number; extractDir: string; logPath: string }) {
  return `#!/bin/sh
set -eu
ZIP="${input.zipPath}"
DEST="${input.appRoot}"
EXE="${input.executablePath}"
APP_PID="${input.processId}"
TMP="${input.extractDir}"
LOG="${input.logPath}"

echo "Waiting for Moodle AI Review Assistant to close..." > "$LOG"
while kill -0 "$APP_PID" 2>/dev/null; do
  sleep 1
done

echo "Extracting update..." >> "$LOG"
mkdir -p "$TMP"
unzip -q -o "$ZIP" -d "$TMP" >> "$LOG" 2>&1

SRC="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$SRC" ]; then
  echo "Update package has no root folder." >> "$LOG"
  exit 1
fi

echo "Copying update from $SRC to $DEST..." >> "$LOG"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude data "$SRC"/ "$DEST"/ >> "$LOG" 2>&1
else
  cp -R "$SRC"/. "$DEST"/ >> "$LOG" 2>&1
fi

chmod +x "$EXE" 2>/dev/null || true
"$EXE" >/dev/null 2>&1 &
`;
}

export class UpdateService {
  async check() {
    const repository = repoName();
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "moodle-ai-reviewer",
      },
      signal: AbortSignal.timeout(Number(process.env.UPDATE_CHECK_TIMEOUT_MS ?? 15_000)),
    });

    if (!response.ok) {
      throw new Error(`Update check failed: ${response.status}`);
    }

    const release = (await response.json()) as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name);
    const updateAvailable = compareVersions(latestVersion, appVersion) > 0;
    const platformHint = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
    const recommendedAsset =
      release.assets.find((asset) => asset.name.toLowerCase().includes(platformHint) && asset.name.toLowerCase().endsWith(".zip")) ??
      release.assets.find((asset) => asset.name.toLowerCase().includes(platformHint)) ??
      release.assets[0] ??
      null;

    return {
      repository,
      currentVersion: appVersion,
      latestVersion,
      updateAvailable,
      releaseName: release.name ?? release.tag_name,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      notes: release.body ?? "",
      recommendedAsset,
      assets: release.assets.map((asset) => ({
        name: asset.name,
        url: asset.browser_download_url,
        size: asset.size,
      })),
    };
  }

  async openLatestRelease() {
    const update = await this.check();
    openUrl(update.releaseUrl);
    return update;
  }

  async applyLatestUpdate() {
    const update = await this.check();
    if (!update.updateAvailable) {
      return { ...update, applying: false, message: "Already on latest version" };
    }

    const asset =
      update.assets.find((item) => item.name.toLowerCase().includes(process.platform === "win32" ? "windows" : "macos") && item.name.toLowerCase().endsWith(".zip")) ??
      update.assets.find((item) => item.name.toLowerCase().endsWith(".zip"));
    if (!asset) {
      throw new Error("No zip release asset available for self update.");
    }

    await mkdir(paths.updates, { recursive: true });
    const zipPath = join(paths.updates, safeFilename(asset.name));
    const extractDir = join(paths.updates, `extract-${update.latestVersion}-${Date.now()}`);
    const logPath = join(paths.updates, "update.log");

    const response = await fetch(asset.url, {
      redirect: "follow",
      headers: { "User-Agent": "moodle-ai-reviewer" },
      signal: AbortSignal.timeout(Number(process.env.UPDATE_DOWNLOAD_TIMEOUT_MS ?? 120_000)),
    });
    if (!response.ok) {
      throw new Error(`Update download failed: ${response.status}`);
    }

    await Bun.write(zipPath, await response.arrayBuffer());

    const executablePath = process.execPath;
    const scriptPath = join(paths.updates, process.platform === "win32" ? "apply-update.cmd" : "apply-update.sh");
    const script =
      process.platform === "win32"
        ? windowsUpdaterScript({ zipPath, appRoot: paths.root, executablePath, processId: process.pid, extractDir, logPath })
        : unixUpdaterScript({ zipPath, appRoot: paths.root, executablePath, processId: process.pid, extractDir, logPath });
    await writeFile(scriptPath, script, "utf8");
    if (process.platform !== "win32") await chmod(scriptPath, 0o755);

    const child =
      process.platform === "win32"
        ? spawn("cmd", ["/c", scriptPath], { detached: true, stdio: "ignore" })
        : spawn(scriptPath, [], { detached: true, stdio: "ignore" });
    child.unref();

    setTimeout(() => process.exit(0), 1000);

    return {
      ...update,
      applying: true,
      message: `Downloaded ${basename(zipPath)}. App will close and apply the update.`,
      asset,
      logPath,
    };
  }
}
