import { rm, mkdir } from "node:fs/promises";
import { paths } from "../src/runtime/paths";

await rm(paths.data, { recursive: true, force: true });
await Promise.all([
  mkdir(paths.downloads, { recursive: true }),
  mkdir(paths.extracted, { recursive: true }),
  mkdir(paths.sessions, { recursive: true }),
  mkdir(paths.logs, { recursive: true }),
]);

console.log("Data reset complete.");
