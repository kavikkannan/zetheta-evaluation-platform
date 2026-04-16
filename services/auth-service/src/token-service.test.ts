import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenService } from "./token-service";

class InMemoryRedis {
  private readonly data = new Map<string, string>();

  public async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  public async eval(_lua: string, _keysCount: number, key: string): Promise<number> {
    if (!this.data.has(key)) {
      return 0;
    }

    this.data.delete(key);
    return 1;
  }
}

function createTempKeyPair(): { privateKeyPath: string; publicKeyPath: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-keys-"));
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

describe("TokenService", () => {
  it("signs and verifies a session token", () => {
    const redis = new InMemoryRedis();
    const keys = createTempKeyPair();
    const service = new TokenService(redis as never, {
      privateKeyPath: keys.privateKeyPath,
      publicKeyPath: keys.publicKeyPath,
      issuer: "https://zetheta.com",
      audience: "assessment-engine",
      sessionTtlSeconds: 3600,
      crossAppTtlSeconds: 60,
    });

    const token = service.signSessionToken({
      sub: "user-id",
      email: "user@example.com",
      name: "User",
      role: "candidate",
    });

    const payload = service.verifySessionToken(token);
    expect(payload.sub).toBe("user-id");
    expect(payload.email).toBe("user@example.com");
    expect(payload.role).toBe("candidate");
  });

  it("issues and consumes cross-app token once", async () => {
    const redis = new InMemoryRedis();
    const keys = createTempKeyPair();
    const service = new TokenService(redis as never, {
      privateKeyPath: keys.privateKeyPath,
      publicKeyPath: keys.publicKeyPath,
      issuer: "https://zetheta.com",
      audience: "assessment-engine",
      sessionTtlSeconds: 3600,
      crossAppTtlSeconds: 60,
    });

    const token = await service.signCrossAppToken({
      sub: "candidate-id",
      email: "candidate@example.com",
      name: "Candidate",
      role: "candidate",
    });

    const first = await service.verifyCrossAppToken(token);
    expect(first.aud).toBe("assessment-engine");
    expect(first.iss).toBe("https://zetheta.com");
    expect(first.jti).toBeTruthy();

    await expect(service.verifyCrossAppToken(token)).rejects.toThrow(
      "Token already used or expired",
    );
  });
});

