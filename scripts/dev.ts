import { createServer as createHttpServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
import { createServer as createViteServer } from "../src/web/node_modules/vite/dist/node/index.js";
import { initRuntime } from "../src/runtime/init-runtime";
import { migrate } from "../src/database/migrate";
import { createApiApp } from "../src/server";
import { logger } from "../src/shared/logger";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "src", "web");
const port = Number(process.env.APP_PORT ?? 9876);

await initRuntime();
await migrate();

// Backend API as a Node-compatible request listener.
const apiApp = createApiApp();
const apiListener = getRequestListener(apiApp.fetch);

// Vite (assigned below) is referenced by the request handler via closure.
// The handler only runs after listen(), so vite is guaranteed to be set.
let vite: Awaited<ReturnType<typeof createViteServer>>;

// One HTTP server for both API and frontend. Vite attaches its HMR websocket
// to THIS server (see hmr.server below), so everything shares one port.
const server = createHttpServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/health" || url.startsWith("/health?") || url.startsWith("/api")) {
    apiListener(req, res);
    return;
  }
  vite.middlewares(req, res);
});

vite = await createViteServer({
  root: webRoot,
  appType: "spa",
  server: {
    middlewareMode: true,
    hmr: { server },
  },
});

server.listen(port, () => {
  logger.info(`Dev server (API + Vite HMR) running at http://localhost:${port}`);
  process.stdout.write(
    `\n  ➜  http://localhost:${port}  (frontend + backend, HMR aktif)\n` +
      `     Edit file di src/web → langsung reload tanpa build manual.\n\n`,
  );
});

async function shutdown() {
  await vite.close().catch(() => null);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
