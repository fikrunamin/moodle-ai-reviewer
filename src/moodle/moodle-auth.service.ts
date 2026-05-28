import { readFile, writeFile } from "node:fs/promises";
import type { CookieParam } from "puppeteer-core";
import { launchBrowser } from "../browser/puppeteer-client";
import { paths } from "../runtime/paths";

const cookiePath = `${paths.sessions}/moodle-cookies.json`;

function normalizeSameSite(value: unknown): CookieParam["sameSite"] | undefined {
  if (value === "Strict" || value === "Lax" || value === "None") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "lax") return "Lax";
  if (normalized === "none" || normalized === "no_restriction") return "None";
  return undefined;
}

function normalizeExpires(cookie: Record<string, unknown>) {
  const expires = cookie.expires ?? cookie.expirationDate;
  if (typeof expires !== "number" || expires <= 0) return undefined;
  return expires;
}

function normalizeCookieEditorCookie(cookie: Record<string, unknown>, fallbackUrl: URL): CookieParam {
  if (typeof cookie.name !== "string" || cookie.name.length === 0) {
    throw new Error("Cookie JSON tidak valid: field name wajib ada");
  }

  if (typeof cookie.value !== "string") {
    throw new Error(`Cookie JSON tidak valid: field value wajib string untuk ${cookie.name}`);
  }

  return {
    name: cookie.name,
    value: cookie.value,
    domain: typeof cookie.domain === "string" && cookie.domain ? cookie.domain : fallbackUrl.hostname,
    path: typeof cookie.path === "string" && cookie.path ? cookie.path : "/",
    expires: normalizeExpires(cookie),
    httpOnly: Boolean(cookie.httpOnly),
    secure: typeof cookie.secure === "boolean" ? cookie.secure : fallbackUrl.protocol === "https:",
    sameSite: normalizeSameSite(cookie.sameSite),
  };
}

function parseCookieInput(input: { baseUrl: string; cookies: string }): CookieParam[] {
  const url = new URL(input.baseUrl);
  const raw = input.cookies.trim();
  if (!raw) throw new Error("Cookies kosong");

  if (raw.startsWith("[") || raw.startsWith("{")) {
    const parsed = JSON.parse(raw);
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;
    if (!Array.isArray(cookies)) throw new Error("JSON cookies harus berupa array atau object { cookies: [] }");
    return cookies.map((cookie) => normalizeCookieEditorCookie(cookie as Record<string, unknown>, url));
  }

  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) throw new Error("Format Cookie header tidak valid");
      return {
        name: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim(),
        domain: url.hostname,
        path: "/",
        secure: url.protocol === "https:",
      };
    });
}

export class MoodleAuthService {
  async saveCookies(input: { baseUrl: string; cookies: string }) {
    const cookies = parseCookieInput(input);
    await writeFile(cookiePath, JSON.stringify({ baseUrl: input.baseUrl, cookies }, null, 2), "utf8");
    return { ok: true, count: cookies.length };
  }

  async readCookies(): Promise<CookieParam[]> {
    const raw = await readFile(cookiePath, "utf8");
    const parsed = JSON.parse(raw) as { cookies: CookieParam[] };
    return parsed.cookies;
  }

  async applyCookies(page: { setCookie: (...cookies: CookieParam[]) => Promise<void> }) {
    const cookies = await this.readCookies().catch(() => []);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    return cookies.length;
  }

  async testCookies(input: { baseUrl: string; cookies?: string }) {
    if (input.cookies?.trim()) {
      await this.saveCookies({ baseUrl: input.baseUrl, cookies: input.cookies });
    }
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      const count = await this.applyCookies(page);
      await page.goto(input.baseUrl, { waitUntil: "networkidle2", timeout: 30_000 });
      const loginIndicators = await page
        .$("input[type='password'], input[name='username'], #loginbtn")
        .then((element) => Boolean(element));
      return { ok: !loginIndicators, cookie_count: count, login_required: loginIndicators };
    } finally {
      await browser.close().catch(() => null);
    }
  }

  async openWithCookies(url: string) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await this.applyCookies(page);
    await page.goto(url, { waitUntil: "networkidle2" });
    return { ok: true };
  }
}
