import { existsSync } from "node:fs";

const candidates = [
  process.env.SOFFICE_PATH ?? "",
  process.env.LIBREOFFICE_PATH ?? "",
  // macOS
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "/Applications/OpenOffice.app/Contents/MacOS/soffice",
  // Windows
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  // Linux
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/usr/local/bin/soffice",
  "/snap/bin/libreoffice",
  "/opt/libreoffice/program/soffice",
];

export function findSofficeExecutable(): string | null {
  return candidates.find((path) => path && existsSync(path)) ?? null;
}
