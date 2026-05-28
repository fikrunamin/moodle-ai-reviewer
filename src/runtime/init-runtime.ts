import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { paths } from "./paths";

async function ensureDirectory(path: string) {
  if (existsSync(path)) return;
  await mkdir(path, { recursive: true });
}

export async function initRuntime() {
  await Promise.all([
    ensureDirectory(paths.data),
    ensureDirectory(paths.downloads),
    ensureDirectory(paths.extracted),
    ensureDirectory(paths.rubrics),
    ensureDirectory(paths.sessions),
    ensureDirectory(paths.logs),
  ]);
}
