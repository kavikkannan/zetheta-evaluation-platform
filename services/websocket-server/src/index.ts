import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import pino from "pino";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import { loadConfig } from "./config";

const logger = pino({
  level: "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: { colorize: true },
  } : undefined,
});

interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  candidateId?: string;
}

async function main() {
  const config = loadConfig();
  logger.info({ config }, "Starting WebSocket Server");

  const publicKey = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, "utf-8");

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
      const payload = JSON.parse(message);
      const targetCandidateId = payload.candidateId;

      logger.info({ message, targetCandidateId }, "Filtering score:ready event");

      wss.clients.forEach((client) => {
        const authClient = client as AuthenticatedWebSocket;
        if (
          authClient.readyState === WebSocket.OPEN &&
          authClient.candidateId === targetCandidateId
        ) {
          logger.info({ candidateId: targetCandidateId }, "Broadcasting to target client");
          authClient.send(JSON.stringify({ type: "SCORE_READY", payload }));
        }
      });
    }
  });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    const ip = req.socket.remoteAddress;
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");

    if (!token) {
      logger.warn({ ip }, "Connection attempt without token. Closing.");
      ws.close(1008, "Token required");
      return;
    }

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      }) as any;

      ws.candidateId = decoded.sub;
      logger.info({ ip, candidateId: ws.candidateId }, "New authenticated client connected");
    } catch (err) {
      logger.error({ ip, err }, "Token verification failed. Closing connection.");
      ws.close(1008, "Invalid token");
      return;
    }

    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      logger.debug({ data: data.toString() }, "Received message from client");
    });

    ws.on("close", () => {
      logger.info({ ip, candidateId: ws.candidateId }, "Client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ ip, candidateId: ws.candidateId, err }, "WebSocket error");
    });
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authClient = ws as AuthenticatedWebSocket;
      if (authClient.isAlive === false) {
        logger.info({ candidateId: authClient.candidateId }, "Terminating inactive client");
        return authClient.terminate();
      }

      authClient.isAlive = false;
      authClient.ping();
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
