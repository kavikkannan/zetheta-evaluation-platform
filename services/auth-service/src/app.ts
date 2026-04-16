import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import Redis from "ioredis";
import { verifyPassword } from "@zetheta/utils";
import { parseWithSchema, ValidationException } from "@zetheta/utils";
import { loadConfig } from "./config";
import { loginRequestSchema, tokenRequestSchema, verifyRequestSchema } from "./schemas";
import { TokenService } from "./token-service";

export async function createApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: "info",
      transport: config.NODE_ENV === "development" ? {
        target: "pino-pretty",
        options: { colorize: true },
      } : undefined,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));
  const prisma = new PrismaClient();
  const redis = new Redis(config.REDIS_URL);
  const tokenService = new TokenService(redis, {
    privateKeyPath: config.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: config.JWT_PUBLIC_KEY_PATH,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    sessionTtlSeconds: config.SESSION_TOKEN_TTL_SECONDS,
    crossAppTtlSeconds: config.CROSS_APP_TOKEN_TTL_SECONDS,
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ValidationException) {
      return reply.status(400).send({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          details: error.details.issues,
        },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error",
      },
    });
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const body = parseWithSchema(loginRequestSchema, request.body);

    const candidate = await prisma.candidate.findUnique({
      where: { email: body.data.email },
      include: { role: true },
    });

    if (!candidate) {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
      });
    }

    const passwordValid = await verifyPassword(body.data.password, candidate.passwordHash);
    if (!passwordValid) {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
      });
    }

    const accessToken = tokenService.signSessionToken({
      sub: candidate.id,
      email: candidate.email,
      name: candidate.name,
      role: candidate.role.name,
    });

    return reply.send({
      status: "success",
      data: {
        accessToken,
        user: {
          id: candidate.id,
          email: candidate.email,
          role: candidate.role.name,
          name: candidate.name,
        },
      },
    });
  });

  app.post("/v1/auth/token", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "Missing bearer token" },
      });
    }

    parseWithSchema(tokenRequestSchema, request.body);

    let sessionClaims;
    try {
      sessionClaims = tokenService.verifySessionToken(authHeader.slice("Bearer ".length));
    } catch {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "Invalid session token" },
      });
    }

    const user = await prisma.candidate.findUnique({
      where: { id: sessionClaims.sub },
      include: { role: true },
    });
    if (!user) {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
    }

    const token = await tokenService.signCrossAppToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    });

    return reply.send({
      status: "success",
      data: {
        token,
        expiresIn: config.CROSS_APP_TOKEN_TTL_SECONDS,
      },
    });
  });

  app.post("/v1/auth/verify", async (request, reply) => {
    const body = parseWithSchema(verifyRequestSchema, request.body);

    try {
      const payload = await tokenService.verifyCrossAppToken(body.data.token);
      return reply.send({
        status: "success",
        data: {
          valid: true,
          payload,
        },
      });
    } catch {
      return reply.status(401).send({
        status: "error",
        error: { code: "UNAUTHORIZED", message: "Token invalid or already consumed" },
      });
    }
  });

  return app;
}

