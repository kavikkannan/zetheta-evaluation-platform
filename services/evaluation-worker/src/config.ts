import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BULLMQ_QUEUE_NAME: z.string().default("evaluation-queue"),
  WORKER_ID: z.string().default(process.pid.toString()),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type EvaluationWorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EvaluationWorkerConfig {
  return configSchema.parse(env);
}
