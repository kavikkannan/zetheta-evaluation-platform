import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // JWT verification (fail-closed on signature/claims/nonce mismatch)
  JWT_PUBLIC_KEY_PATH: z.string().default("/run/secrets/jwt_public_key.pem"),
  JWT_ISSUER: z.string().default("https://zetheta.com"),
  JWT_AUDIENCE: z.string().default("assessment-engine"),

  // BullMQ queue
  BULLMQ_QUEUE_NAME: z.string().default("evaluation-queue"),

  // Upstream services (docker compose service names)
  AUTH_SERVICE_URL: z.string().default("http://auth-service:3002"),

  // Rate limiting (per minute)
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(60),
  AUTH_RATE_LIMIT_PER_IP_PER_WINDOW: z.coerce.number().default(10),
  GENERAL_RATE_LIMIT_PER_USER_PER_WINDOW: z.coerce.number().default(100),
  SUBMISSIONS_RATE_LIMIT_PER_USER_PER_WINDOW: z.coerce.number().default(5),
});

export type ApiGatewayConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiGatewayConfig {
  return configSchema.parse(env);
}

