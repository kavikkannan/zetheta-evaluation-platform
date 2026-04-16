import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3003),
  REDIS_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
