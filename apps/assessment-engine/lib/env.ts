import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://127.0.0.1:3001/v1"),
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  JWT_PUBLIC_KEY_PATH: z.string().default("../../secrets/jwt_public_key.pem"),
  JWT_ISSUER: z.string().default("https://zetheta.com"),
  JWT_AUDIENCE: z.string().default("assessment-engine"),
  CANDIDATE_PORTAL_URL: z.string().url().default("http://127.0.0.1:4001"),
  INTERNAL_TOKEN_SECRET: z.string().min(16).default("zetheta-internal-secret"),
  // Internal API URL for Server-Side-Rendering (SSR)
  API_BASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_PUBLIC_KEY_PATH: process.env.JWT_PUBLIC_KEY_PATH,
  JWT_ISSUER: process.env.JWT_ISSUER,
  JWT_AUDIENCE: process.env.JWT_AUDIENCE,
  CANDIDATE_PORTAL_URL: process.env.CANDIDATE_PORTAL_URL,
  INTERNAL_TOKEN_SECRET: process.env.INTERNAL_TOKEN_SECRET,
  API_BASE_URL: process.env.API_BASE_URL,
});
