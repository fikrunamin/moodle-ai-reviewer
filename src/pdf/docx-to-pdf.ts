import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { nanoid } from "nanoid";
import { paths } from "../runtime/paths";
import { logger } from "../shared/logger";
import { findSofficeExecutable } from "./soffice-finder";

/**
 * Convert a DOCX/DOC to PDF using LibreOffice headless. Unlike an HTML render,
 * this preserves images, hyperlinks, tables, and layout from the original
 * document.
 *
 * Requires LibreOffice (soffice) installed; the path is auto-detected or set
 * via SOFFICE_PATH. Returns the output PDF path, or null if conversion is
 * unavailable or fails.
 */

export function isDocxToPdfAvailable(): boolean {
  return Boolean(findSofficeExecutable());
}

function runSoffice(args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  const executable = findSofficeExecutable();
  if (!executable) return Promise.resolve({ code: -1, stderr: "soffice not found" });

  return new Promise((resolve) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: -2, stderr: `soffice timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stderr: error.message });
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

export async function convertDocxToPdf(docxPath: string): Promise<string | null> {
  if (!existsSync(docxPath)) {
    logger.warn("DOCX->PDF: source file missing", docxPath);
    return null;
  }
  if (!isDocxToPdfAvailable()) {
    logger.warn(
      "DOCX->PDF: LibreOffice (soffice) not found. Set SOFFICE_PATH or install LibreOffice to enable DOCX preview.",
    );
    return null;
  }

  const timeoutMs = Number(process.env.SOFFICE_TIMEOUT_MS ?? 90_000);
  // Use an isolated output dir + user profile so concurrent/GUI instances
  // don't clash and we can reliably find the result.
  const outDir = join(paths.downloads, `._soffice_${nanoid()}`);
  const profileDir = join(paths.downloads, `._sofficeprofile_${nanoid()}`);
  await mkdir(outDir, { recursive: true });

  try {
    const result = await runSoffice(
      [
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        `-env:UserInstallation=file://${profileDir}`,
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        docxPath,
      ],
      timeoutMs,
    );

    if (result.code !== 0) {
      logger.warn(`DOCX->PDF: soffice failed (code ${result.code})`, result.stderr.slice(0, 300));
      return null;
    }

    // LibreOffice names the output <basename>.pdf in outDir.
    const baseNoExt = basename(docxPath, extname(docxPath));
    const producedPath = join(outDir, `${baseNoExt}.pdf`);
    if (!existsSync(producedPath)) {
      logger.warn("DOCX->PDF: expected output not found", producedPath);
      return null;
    }

    const finalPath = join(paths.downloads, `${basename(docxPath)}.pdf`);
    await rm(finalPath, { force: true }).catch(() => null);
    await rename(producedPath, finalPath);
    return finalPath;
  } catch (error) {
    logger.warn("DOCX->PDF: conversion error", error);
    return null;
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => null);
    await rm(profileDir, { recursive: true, force: true }).catch(() => null);
  }
}
