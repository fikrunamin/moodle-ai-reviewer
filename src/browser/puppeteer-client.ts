import puppeteer, { type Browser } from "puppeteer-core";
import { paths } from "../runtime/paths";
import { findChromeExecutable } from "./chrome-finder";
import { AppError } from "../shared/errors";

export async function launchBrowser(): Promise<Browser> {
  const executablePath = findChromeExecutable();

  if (!executablePath) {
    throw new AppError("Chrome executable not found", "CHROME_NOT_FOUND");
  }

  return puppeteer.launch({
    executablePath,
    headless: process.env.PUPPETEER_HEADLESS !== "false",
    userDataDir: paths.sessions,
    args: ["--no-first-run", "--no-default-browser-check"],
  });
}
