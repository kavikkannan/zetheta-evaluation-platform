import { createApp } from "./app";
import { loadConfig } from "./config";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp();
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

