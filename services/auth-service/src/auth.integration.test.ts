import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { hashPassword } from "@zetheta/utils";
import { createApp } from "./app";
import { TokenService } from "./token-service";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

function createTempKeyPair(): { privateKeyPath: string; publicKeyPath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-int-keys-"));
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privateKeyPath = path.join(tmpDir, "jwt_private_key.pem");
  const publicKeyPath = path.join(tmpDir, "jwt_public_key.pem");
  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  return { privateKeyPath, publicKeyPath };
}

const keys = createTempKeyPair();
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://zetheta:zetheta@localhost:5432/zetheta";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_PRIVATE_KEY_PATH = keys.privateKeyPath;
process.env.JWT_PUBLIC_KEY_PATH = keys.publicKeyPath;
process.env.JWT_ISSUER = "https://zetheta.com";
process.env.JWT_AUDIENCE = "assessment-engine";
process.env.CROSS_APP_TOKEN_TTL_SECONDS = "60";

describe("Auth integration", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    await redis.flushdb();
    app = await createApp();

    const candidateRole = await prisma.role.upsert({
      where: { name: "candidate" },
      update: {},
      create: { name: "candidate" },
    });

    const passwordHash = await hashPassword("Password@123");
    await prisma.candidate.upsert({
      where: { email: "auth.integration@example.com" },
      update: { passwordHash, roleId: candidateRole.id, name: "Auth Integration" },
      create: {
        email: "auth.integration@example.com",
        passwordHash,
        roleId: candidateRole.id,
        name: "Auth Integration",
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await redis.quit();
  });

  it("generates token, verifies once, then rejects replay and keeps 60s ttl", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        data: { email: "auth.integration@example.com", password: "Password@123" },
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginJson = loginResponse.json();
    const sessionToken = loginJson.data.accessToken as string;

    const tokenResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { data: { applicationId: "123e4567-e89b-12d3-a456-426614174000" } },
    });

    expect(tokenResponse.statusCode).toBe(200);
    const crossToken = tokenResponse.json().data.token as string;

    const decoded = jwt.decode(crossToken) as { jti: string };
    const key = `token:${decoded.jti}`;
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    const verify1 = await app.inject({
      method: "POST",
      url: "/v1/auth/verify",
      payload: { data: { token: crossToken } },
    });
    expect(verify1.statusCode).toBe(200);

    const nonceAfterFirstVerify = await redis.get(key);
    expect(nonceAfterFirstVerify).toBeNull();

    const verify2 = await app.inject({
      method: "POST",
      url: "/v1/auth/verify",
      payload: { data: { token: crossToken } },
    });
    expect(verify2.statusCode).toBe(401);
  });

  it("stores jti in Redis on token generation", async () => {
    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { email: "auth.integration@example.com" },
      include: { role: true },
    });

    const tokenService = new TokenService(redis, {
      privateKeyPath: keys.privateKeyPath,
      publicKeyPath: keys.publicKeyPath,
      issuer: "https://zetheta.com",
      audience: "assessment-engine",
      sessionTtlSeconds: 3600,
      crossAppTtlSeconds: 60,
    });

    const token = await tokenService.signCrossAppToken({
      sub: candidate.id,
      email: candidate.email,
      name: candidate.name,
      role: candidate.role.name,
    });

    const decoded = jwt.decode(token) as { jti: string };
    const exists = await redis.get(`token:${decoded.jti}`);
    expect(exists).toBe("valid");
  });
});

