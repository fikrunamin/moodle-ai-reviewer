import { initRuntime } from "./runtime/init-runtime";
import { startServer } from "./server";
import { migrate } from "./database/migrate";
import { openLocalhost } from "./runtime/open-localhost";
import { logger } from "./shared/logger";
import { sendTelegramError } from "./shared/telegram-notifier";

async function reportFatalError(message: string, error: unknown) {
  console.error(`[error] ${message}`, error);
  await sendTelegramError(message, error);
}

process.on("uncaughtException", (error) => {
  void reportFatalError("Uncaught exception", error).finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  void reportFatalError("Unhandled rejection", reason).finally(() => process.exit(1));
});

try {
  await initRuntime();
  await migrate();

  const port = Number(process.env.APP_PORT ?? 9876);
  await startServer(port);
  openLocalhost(port);

  logger.info(`Server running at http://localhost:${port}`);
} catch (error) {
  await reportFatalError("Startup failed", error);
  process.exit(1);
}
