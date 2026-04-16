import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:3001/v1"),
  NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: z.string().url().default("http://localhost:4002"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: process.env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL,
});
