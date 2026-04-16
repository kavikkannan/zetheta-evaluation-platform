import { createApp } from "./app";
import { loadConfig } from "./config";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp();
  const address = await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`Service explicitly listening on ${address}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

