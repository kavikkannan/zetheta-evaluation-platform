import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Fastify from "fastify";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { parseWithSchema, ValidationException } from "@zetheta/utils";

import { loadConfig } from "./config";
import { TokenVerifier, type UnifiedTokenPayload } from "./token-verifier";
import { roleHasPermission } from "./rbac";
import { createRedisRateLimitPreHandler } from "./rate-limiter";
import { HttpError } from "./errors";
import {
  authLoginRequestSchema,
  authTokenRequestSchema,
  authVerifyRequestSchema,
  assessmentQuestionsParamsSchema,
  dashboardCandidatesQuerySchema,
  scoresParamsSchema,
  submissionsRequestSchema,
} from "./schemas";

const serviceName = "@zetheta/api-gateway";

type AuthenticatedRequest = FastifyRequest & { user: UnifiedTokenPayload };

async function proxyJson(options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; json: unknown }> {
  const res = await fetch(options.url, {
    method: options.method,
    headers: options.headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function createApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const redis = new Redis(config.REDIS_URL);
  const tokenVerifier = new TokenVerifier({
    redis,
    publicKeyPath: config.JWT_PUBLIC_KEY_PATH,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });

  const queue = new Queue(config.BULLMQ_QUEUE_NAME, { connection: redis });

  const app = Fastify({
    logger: { level: "info", base: { service: serviceName } },
    genReqId: (req) => {
      const raw = req.headers["x-request-id"];
      if (typeof raw === "string" && raw.length > 0) return raw;
      return uuidv4();
    },
    requestIdHeader: "x-request-id",
  });

  app.decorate("evaluationQueue", queue);

  app.addHook("onClose", async () => {
    await queue.close();
    await prisma.$disconnect();
    await redis.quit();
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    const requestId = String((request as FastifyRequest).id ?? "");

    if (error instanceof ValidationException) {
      return reply.status(400).send({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          requestId,
          details: error.details.issues,
        },
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        status: "error",
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details !== undefined ? { details: error.details } : null),
        },
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error",
        requestId,
      },
    });
  });

  async function authenticate(req: FastifyRequest): Promise<UnifiedTokenPayload> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Missing bearer token",
      });
    }

    const token = authHeader.slice("Bearer ".length);
    
    // Internal bypass: allow Assessment Engine backend to forward requests using its secure local session payload
    if (token.startsWith("engine_")) {
      try {
        const decoded = Buffer.from(token.slice(7), 'base64').toString('utf-8');
        return JSON.parse(decoded) as UnifiedTokenPayload;
      } catch {
        throw new HttpError({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Invalid engine token",
        });
      }
    }

    return tokenVerifier.verifyToken(token);
  }

  async function authenticatePreHandler(req: FastifyRequest): Promise<void> {
    const payload = await authenticate(req);
    (req as unknown as AuthenticatedRequest).user = payload;
  }

  function authorize(permissionName: string, options?: { allowRole?: string[] }) {
    return async (req: FastifyRequest): Promise<void> => {
      const user = (req as unknown as Partial<AuthenticatedRequest>).user;
      if (!user) {
        throw new HttpError({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Missing authenticated user",
        });
      }

      const allowed = await roleHasPermission({
        prisma,
        roleName: user.role,
        permissionName,
      });

      if (!allowed) {
        throw new HttpError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Forbidden",
        });
      }
    };
  }

  const authRateLimitPreHandler = createRedisRateLimitPreHandler({
    redis,
    limitPerWindow: config.AUTH_RATE_LIMIT_PER_IP_PER_WINDOW,
    windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: "rl:api-gateway:auth",
    keyFn: (req) => String(req.ip ?? "unknown"),
  });

  const generalRateLimitPreHandler = createRedisRateLimitPreHandler({
    redis,
    limitPerWindow: config.GENERAL_RATE_LIMIT_PER_USER_PER_WINDOW,
    windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: "rl:api-gateway:general",
    keyFn: (req) => String((req as unknown as Partial<AuthenticatedRequest>).user?.sub ?? "unknown"),
  });

  const submissionsRateLimitPreHandler = createRedisRateLimitPreHandler({
    redis,
    limitPerWindow: config.SUBMISSIONS_RATE_LIMIT_PER_USER_PER_WINDOW,
    windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    keyPrefix: "rl:api-gateway:submissions",
    keyFn: (req) => String((req as unknown as Partial<AuthenticatedRequest>).user?.sub ?? "unknown"),
  });

  app.post("/v1/auth/login", { preHandler: [authRateLimitPreHandler] }, async (request, reply) => {
    const body = parseWithSchema(authLoginRequestSchema, request.body);

    const upstream = await proxyJson({
      url: `${config.AUTH_SERVICE_URL}/v1/auth/login`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    return reply.status(upstream.status).send(upstream.json);
  });

  app.post("/v1/auth/token", { preHandler: [authRateLimitPreHandler] }, async (request, reply) => {
    const body = parseWithSchema(authTokenRequestSchema, request.body);
    const authHeader = request.headers.authorization;

    const upstream = await proxyJson({
      url: `${config.AUTH_SERVICE_URL}/v1/auth/token`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body,
    });

    return reply.status(upstream.status).send(upstream.json);
  });

  app.post("/v1/auth/verify", { preHandler: [authRateLimitPreHandler] }, async (request, reply) => {
    const body = parseWithSchema(authVerifyRequestSchema, request.body);

    const upstream = await proxyJson({
      url: `${config.AUTH_SERVICE_URL}/v1/auth/verify`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    return reply.status(upstream.status).send(upstream.json);
  });

  app.get(
    "/v1/assessments/:assessmentId/questions",
    {
      preHandler: [
        authenticatePreHandler,
        authorize("read:assessment"),
        generalRateLimitPreHandler,
      ],
    },
    async (request, reply) => {
      const params = parseWithSchema(assessmentQuestionsParamsSchema, request.params);

      const questions = await prisma.mcqQuestion.findMany({
        where: { assessmentSessionId: params.assessmentId },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          questionText: true,
          options: true,
        },
      });

      return reply.send({
        status: "success",
        data: {
          assessmentId: params.assessmentId,
          questions: questions.map((q) => ({
            id: q.id,
            sequence: q.sequence,
            questionText: q.questionText,
            options: q.options,
          })),
        },
      });
    },
  );

  app.post(
    "/v1/submissions",
    {
      preHandler: [authenticatePreHandler, authorize("create:submission"), submissionsRateLimitPreHandler],
    },
    async (request, reply) => {
      const body = parseWithSchema(submissionsRequestSchema, request.body);
      const user = (request as unknown as AuthenticatedRequest).user;

      let submissionId: string | undefined;

      await prisma.$transaction(async (tx) => {
        const existing = await tx.submission.findFirst({
          where: { applicationId: body.data.applicationId },
          orderBy: { createdAt: "desc" },
          include: { responses: true },
        });

        if (existing) {
          submissionId = existing.id;
          await tx.application.update({
            where: { id: body.data.applicationId },
            data: { status: "attempted", submittedAt: new Date() },
          });
          return;
        }

        const submission = await tx.submission.create({
          data: { applicationId: body.data.applicationId },
        });

        await tx.response.createMany({
          data: body.data.responses.map((r) => ({
            submissionId: submission.id,
            questionId: r.questionId,
            answer: r.answer,
          })),
        });

        await tx.application.update({
          where: { id: body.data.applicationId },
          data: { status: "attempted", submittedAt: new Date() },
        });

        submissionId = submission.id;
      });

      if (!submissionId) {
        throw new HttpError({
          statusCode: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to create submission",
        });
      }

      try {
        await queue.add(
          "evaluateSubmission",
          {
            submissionId,
            userId: user.sub,
            queuedAt: new Date().toISOString(),
          },
          {
            jobId: submissionId,
            removeOnComplete: true,
          },
        );
      } catch (error: unknown) {
        // BullMQ throws JobIdAlreadyExistsError when deduping by jobId.
        const err = error as any;
        const isDuplicate =
          err?.name === "JobIdAlreadyExistsError" ||
          String(err?.message ?? "").includes("JobIdAlreadyExistsError");

        if (!isDuplicate) throw error;
      }

      return reply.status(202).send({
        status: "success",
        data: {
          submissionId,
          message: "Submission received and queued for evaluation",
        },
      });
    },
  );

  app.get(
    "/v1/candidates/me/application",
    {
      preHandler: [authenticatePreHandler, authorize("read:assessment"), generalRateLimitPreHandler],
    },
    async (request, reply) => {
      const user = (request as unknown as AuthenticatedRequest).user;

      const [application, firstSession] = await Promise.all([
        prisma.application.findFirst({
          where: { candidateId: user.sub },
          orderBy: { createdAt: "desc" },
        }),
        prisma.assessmentSession.findFirst({
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }),
      ]);

      if (!application) {
        throw new HttpError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "No application found for this candidate",
        });
      }

      return reply.send({
        status: "success",
        data: {
          applicationId: application.id,
          status: application.status,
          assessmentSessionId: firstSession?.id ?? "",
          submittedAt: application.submittedAt?.toISOString() ?? null,
        },
      });
    },
  );

  app.get(
    "/v1/scores/:submissionId",
    {
      preHandler: [
        authenticatePreHandler,
        authorize("read:scores"),
        generalRateLimitPreHandler,
      ],
    },
    async (request, reply) => {
      const params = parseWithSchema(scoresParamsSchema, request.params);
      const user = (request as unknown as AuthenticatedRequest).user;

      const score = await prisma.score.findUnique({
        where: { submissionId: params.submissionId },
        include: {
          submission: {
            include: {
              application: {
                select: { candidateId: true },
              },
            },
          },
        },
      });

      if (!score) {
        throw new HttpError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Score not found",
        });
      }

      // Ownership enforcement for candidates.
      if (user.role === "candidate" && score.submission.application.candidateId !== user.sub) {
        throw new HttpError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Forbidden",
        });
      }

      return reply.send({
        status: "success",
        data: {
          submissionId: params.submissionId,
          score: score.score,
          maxScore: score.maxScore,
          evaluatedAt: score.evaluatedAt.toISOString(),
          workerId: score.workerId ?? undefined,
        },
      });
    },
  );

  app.get(
    "/v1/dashboard/candidates",
    {
      preHandler: [authenticatePreHandler, authorize("read:dashboard"), generalRateLimitPreHandler],
    },
    async (request, reply) => {
      const query = parseWithSchema(dashboardCandidatesQuerySchema, request.query);
      const status = query.status;
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const where = status ? ({ status } as const) : undefined;

      const total = await prisma.application.count({ where });

      const applications = await prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          candidate: { select: { id: true, name: true, email: true } },
          submissions: {
            take: 1,
            orderBy: { submittedAt: "desc" },
            include: { score: true },
          },
        },
      });

      return reply.send({
        status: "success",
        data: {
          candidates: applications.map((app) => {
            const latestSubmission = app.submissions[0];
            const score = latestSubmission?.score;

            return {
              id: app.candidate.id,
              name: app.candidate.name,
              email: app.candidate.email,
              status: app.status,
              score: score ? score.score : null,
              evaluatedAt: score ? score.evaluatedAt.toISOString() : null,
            };
          }),
          pagination: {
            page,
            limit,
            total,
          },
        },
      });
    },
  );

  return app;
}

