import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { PrismaClient } from "@zetheta/database-client";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";

import { createApp } from "./app";

const prisma = new PrismaClient();

function createTempKeyPair(): { privateKeyPath: string; publicKeyPath: string; privateKeyPem: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-gw-test-keys-"));

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privateKeyPath = path.join(tmpDir, "jwt_private_key.pem");
  const publicKeyPath = path.join(tmpDir, "jwt_public_key.pem");

  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);

  return {
    privateKeyPath,
    publicKeyPath,
    privateKeyPem: privateKey.toString(),
  };
}

async function flushDb(): Promise<void> {
  await prisma.score.deleteMany();
  await prisma.response.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.application.deleteMany();
  await prisma.mcqQuestion.deleteMany();
  await prisma.assessmentSession.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
}

describe("@zetheta/api-gateway (Phase 04)", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let queue: Queue;
  let redis: Redis;

  let candidateRoleId: string;
  let createSubmissionPermissionName = "create:submission";

  let candidateUser: { id: string; email: string; name: string; role: string };
  let applicationId: string;
  let questionId: string;

  let privateKeyPem: string;
  let publicKeyPath: string;
  const issuer = process.env.JWT_ISSUER ?? "https://zetheta.com";
  const audience = process.env.JWT_AUDIENCE ?? "assessment-engine";

  beforeAll(async () => {
    process.env.JWT_ISSUER = issuer;
    process.env.JWT_AUDIENCE = audience;

    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgresql://zetheta:zetheta@localhost:5432/zetheta";
    process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

    const keys = createTempKeyPair();
    privateKeyPem = keys.privateKeyPem;
    publicKeyPath = keys.publicKeyPath;
    process.env.JWT_PUBLIC_KEY_PATH = publicKeyPath;

    redis = new Redis(process.env.REDIS_URL);
    await redis.flushdb();

    await flushDb();

    const candidateRole = await prisma.role.create({ data: { name: "candidate" } });
    candidateRoleId = candidateRole.id;

    const permission = await prisma.permission.create({ data: { name: createSubmissionPermissionName } });
    await prisma.rolePermission.create({
      data: { roleId: candidateRole.id, permissionId: permission.id },
    });

    // Employer role exists but does not get create:submission permission to test RBAC denial.
    await prisma.role.create({ data: { name: "employer" } });

    const assessmentSession = await prisma.assessmentSession.create({
      data: { title: "Test Assessment", description: null, timeLimitMinutes: 30 },
    });

    const question = await prisma.mcqQuestion.create({
      data: {
        assessmentSessionId: assessmentSession.id,
        sequence: 1,
        questionText: "Q1",
        options: [{ label: "A", text: "Option A" }],
        correctAnswer: "A",
      },
    });
    questionId = question.id;

    candidateUser = {
      id: uuidv4(),
      email: "candidate1@example.com",
      name: "Candidate One",
      role: "candidate",
    };

    // Create candidate + application for the submission endpoint.
    await prisma.candidate.create({
      data: {
        id: candidateUser.id,
        email: candidateUser.email,
        passwordHash: "irrelevant",
        name: candidateUser.name,
        roleId: candidateRole.id,
      },
    });

    const application = await prisma.application.create({
      data: { candidateId: candidateUser.id, status: "applied", startedAt: null, submittedAt: null },
    });
    applicationId = application.id;

    app = await createApp();
    queue = (app as any).evaluationQueue as Queue;
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  async function issueTokenAndSetNonce(params: { role: string }): Promise<{ token: string; jti: string }> {
    const jti = uuidv4();
    const token = jwt.sign(
      {
        sub: candidateUser.id,
        email: candidateUser.email,
        name: candidateUser.name,
        role: params.role,
        jti,
      },
      privateKeyPem,
      {
        algorithm: "RS256",
        issuer,
        audience,
        expiresIn: 60,
      },
    );

    await redis.set(`token:${jti}`, "valid", "EX", 60);
    return { token, jti };
  }

  async function waitForJob(jobId: string): Promise<unknown> {
    for (let i = 0; i < 20; i++) {
      const job = await queue.getJob(jobId);
      if (job) return job;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  it("successful submission creates DB records and enqueues BullMQ job", async () => {
    const { token } = await issueTokenAndSetNonce({ role: "candidate" });

    const res = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        data: {
          applicationId,
          responses: [{ questionId, answer: "A" }],
        },
      },
    });

    expect(res.statusCode).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.data.submissionId).toBeTruthy();

    const submissionId = body.data.submissionId as string;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { responses: true, application: true },
    });
    expect(submission).not.toBeNull();
    expect(submission?.responses).toHaveLength(1);
    expect(submission?.responses[0]?.questionId).toBe(questionId);

    const job = await waitForJob(submissionId);
    expect(job).not.toBeNull();
  });

  it("idempotent enqueue reuses submissionId and dedupes BullMQ job", async () => {
    const { token: token1 } = await issueTokenAndSetNonce({ role: "candidate" });
    const res1 = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      headers: { authorization: `Bearer ${token1}` },
      payload: { data: { applicationId, responses: [{ questionId, answer: "A" }] } },
    });

    expect(res1.statusCode).toBe(202);
    const body1 = await res1.json();
    const submissionId = body1.data.submissionId as string;

    const { token: token2 } = await issueTokenAndSetNonce({ role: "candidate" });
    const res2 = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      headers: { authorization: `Bearer ${token2}` },
      payload: { data: { applicationId, responses: [{ questionId, answer: "A" }] } },
    });

    expect(res2.statusCode).toBe(202);
    const body2 = await res2.json();
    expect(body2.data.submissionId).toBe(submissionId);

    const waitingJobs = await queue.getJobs(["waiting"]);
    expect(waitingJobs.map((j) => j.id)).toContain(submissionId);
    expect(waitingJobs.length).toBe(1);
  });

  it("rate limiting enforces 5 req/min per user on submissions", async () => {
    // Reset only the submissions rate-limit counter for this user.
    await redis.del(`rl:api-gateway:submissions:${candidateUser.id}`);

    // Ensure we start a new nonce each request so auth passes.
    const calls = Array.from({ length: 6 }, async () => {
      const { token } = await issueTokenAndSetNonce({ role: "candidate" });
      return app.inject({
        method: "POST",
        url: "/v1/submissions",
        headers: { authorization: `Bearer ${token}` },
        payload: { data: { applicationId, responses: [{ questionId, answer: "A" }] } },
      });
    });

    const results = await Promise.all(calls);
    const statuses = results.map((r) => r.statusCode);

    expect(statuses.filter((s) => s === 202).length).toBe(5);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
  });

  it("missing token rejects with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      payload: { data: { applicationId, responses: [{ questionId, answer: "A" }] } },
    });

    expect(res.statusCode).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("RBAC forbids token role without create:submission permission", async () => {
    const { token } = await issueTokenAndSetNonce({ role: "employer" });
    const res = await app.inject({
      method: "POST",
      url: "/v1/submissions",
      headers: { authorization: `Bearer ${token}` },
      payload: { data: { applicationId, responses: [{ questionId, answer: "A" }] } },
    });

    expect(res.statusCode).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

