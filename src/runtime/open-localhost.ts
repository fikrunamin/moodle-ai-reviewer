import { spawn } from "node:child_process";

export function openLocalhost(port: number) {
  const url = `http://localhost:${port}`;

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" });
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" });
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
}
