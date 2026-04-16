import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import pino from "pino";
import { loadConfig } from "./config";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

async function main() {
  const config = loadConfig();
  logger.info({ config }, "Starting WebSocket Server");

  const wss = new WebSocketServer({ port: config.PORT });
  const redisSubscriber = new Redis(config.REDIS_URL);

  // Subscribe to scoring events from the evaluation worker
  await redisSubscriber.subscribe("score:ready", (err, count) => {
    if (err) {
      logger.error({ err }, "Failed to subscribe to Redis channel");
      process.exit(1);
    }
    logger.info({ count }, "Subscribed to Redis 'score:ready' channel");
  });

  // Handle incoming messages from Redis
  redisSubscriber.on("message", (channel, message) => {
    if (channel === "score:ready") {
      logger.info({ message }, "Broadcasting score:ready event");
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "SCORE_READY", payload: JSON.parse(message) }));
        }
      });
    }
  });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info({ ip }, "New client connected");

    (ws as any).isAlive = true;

    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    ws.on("message", (data) => {
      logger.debug({ data: data.toString() }, "Received message from client");
    });

    ws.on("close", () => {
      logger.info({ ip }, "Client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ ip, err }, "WebSocket error");
    });
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        logger.info("Terminating inactive client");
        return ws.terminate();
      }

      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  logger.info(`WebSocket Server listening on port ${config.PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Graceful shutdown initiated...");
    clearInterval(interval);
    await redisSubscriber.quit();
    wss.close(() => {
      logger.info("WebSocket server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error(err, "Fatal error during WebSocket server startup");
  process.exit(1);
});
