import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:3001/v1"),
  NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: z.string().url().default("http://localhost:4002"),
  // Internal API URL for Server-Side-Rendering (SSR)
  API_BASE_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: process.env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL,
  API_BASE_URL: process.env.API_BASE_URL,
});
