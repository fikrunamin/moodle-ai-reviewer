import { initRuntime } from "./runtime/init-runtime";
import { startServer } from "./server";
import { migrate } from "./database/migrate";
import { openLocalhost } from "./runtime/open-localhost";
import { logger } from "./shared/logger";

await initRuntime();
await migrate();

const port = Number(process.env.APP_PORT ?? 9876);
await startServer(port);
openLocalhost(port);

logger.info(`Server running at http://localhost:${port}`);
