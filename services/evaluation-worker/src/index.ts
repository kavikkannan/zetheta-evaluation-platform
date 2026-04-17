import { Worker } from "bullmq";
import { PrismaClient } from "@zetheta/database-client";
import Redis from "ioredis";
import pino from "pino";
import Fastify from "fastify";
import { register } from "prom-client";
import { loadConfig } from "./config";
import { EvaluationProcessor } from "./processor";

// Register default metrics
register.setDefaultLabels({ service: "evaluation-worker" });

const logger = pino({
  level: "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: { colorize: true },
  } : undefined,
});

async function main() {
  const config = loadConfig();
  logger.info({ config }, "Loaded Evaluation Worker configuration");

  const prisma = new PrismaClient();
  const redisConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const redisPubSub = new Redis(config.REDIS_URL); // Separate instance for Pub/Sub publishing

  const processor = new EvaluationProcessor(prisma, redisPubSub, config.WORKER_ID);

  const worker = new Worker(
    config.BULLMQ_QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id }, "Execution started");
      return await processor.process(job as any);
    },
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
      limiter: {
        max: parseInt(process.env.WORKER_RATE_LIMIT_MAX || "50", 10),
        duration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION || "1000", 10),
      },
    }
  );

  worker.on("completed", (job, returnvalue) => {
    logger.info({ jobId: job.id, returnvalue }, "Job completed successfully");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "BullMQ Worker error");
  });

  // Metrics and Health server
  const metricsApp = Fastify({ logger: false });
  metricsApp.get("/health", async () => ({ status: "ok" }));
  metricsApp.get("/metrics", async (request, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  metricsApp.listen({ port: 3010, host: "0.0.0.0" }, (err) => {
    if (err) logger.error(err, "Failed to start metrics server");
    else logger.info("Metrics server listening on port 3010");
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Graceful shutdown initiated...");
    await metricsApp.close();
    await worker.close();
    await prisma.$disconnect();
    redisConnection.disconnect();
    redisPubSub.disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error(err, "Fatal error during worker startup");
  process.exit(1);
});
