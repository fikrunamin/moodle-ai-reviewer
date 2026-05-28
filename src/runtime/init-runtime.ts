import { mkdir } from "node:fs/promises";
import { paths } from "./paths";

export async function initRuntime() {
  await Promise.all([
    mkdir(paths.data, { recursive: true }),
    mkdir(paths.downloads, { recursive: true }),
    mkdir(paths.extracted, { recursive: true }),
    mkdir(paths.sessions, { recursive: true }),
    mkdir(paths.logs, { recursive: true }),
  ]);
}
