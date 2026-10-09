import { buildServer } from "./server.js";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { resumePendingResolutions } from "./stellar/retry.js";

async function main() {
  try {
    // Ensure database and migrations are ready
    await getDb();

    const app = await buildServer();

    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`[quiza-api] Fastify server listening on http://${config.HOST}:${config.PORT}`);

    // Resume any pending resolutions that were interrupted
    await resumePendingResolutions();
  } catch (err: any) {
    console.error("[quiza-api] Fatal server startup error:", err?.message || err);
    process.exit(1);
  }
}

main();
