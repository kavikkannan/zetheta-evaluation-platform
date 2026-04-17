import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_PRIVATE_KEY_PATH: z.string().default("./secrets/jwt_private_key.pem"),
  JWT_PUBLIC_KEY_PATH: z.string().default("./secrets/jwt_public_key.pem"),
  JWT_ISSUER: z.string().default("https://zetheta.com"),
  JWT_AUDIENCE: z.string().default("assessment-engine"),
  SESSION_TOKEN_TTL_SECONDS: z.coerce.number().default(60 * 60 * 8),
  CROSS_APP_TOKEN_TTL_SECONDS: z.coerce.number().default(300),
  CORS_ORIGINS: z.string().default("http://localhost:4001,http://localhost:4003"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type AuthConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return configSchema.parse(env);
}

