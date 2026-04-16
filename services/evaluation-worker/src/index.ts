import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import pino from "pino";
import { loadConfig } from "./config";
import { EvaluationProcessor } from "./processor";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
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

  logger.info(`Worker ${config.WORKER_ID} listening on queue: ${config.BULLMQ_QUEUE_NAME}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Graceful shutdown initiated...");
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
