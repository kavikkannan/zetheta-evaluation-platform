import fs from "node:fs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export interface CrossAppClaims extends SessionClaims {
  aud: string;
  iss: string;
  jti: string;
}

export interface TokenServiceConfig {
  privateKeyPath: string;
  publicKeyPath: string;
  issuer: string;
  audience: string;
  sessionTtlSeconds: number;
  crossAppTtlSeconds: number;
}

export class TokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;

  public constructor(
    private readonly redis: Redis,
    private readonly config: TokenServiceConfig,
  ) {
    this.privateKey = fs.readFileSync(config.privateKeyPath, "utf-8");
    this.publicKey = fs.readFileSync(config.publicKeyPath, "utf-8");
  }

  public signSessionToken(claims: SessionClaims): string {
    const options: SignOptions = {
      algorithm: "RS256",
      expiresIn: this.config.sessionTtlSeconds,
      issuer: this.config.issuer,
      audience: "auth-service",
    };

    return jwt.sign(claims, this.privateKey, options);
  }

  public verifySessionToken(token: string): SessionClaims {
    return jwt.verify(token, this.publicKey, {
      algorithms: ["RS256"],
      issuer: this.config.issuer,
      audience: "auth-service",
    }) as SessionClaims;
  }

  public async signCrossAppToken(claims: SessionClaims): Promise<string> {
    const jti = uuidv4();
    const token = jwt.sign(
      { ...claims, jti },
      this.privateKey,
      {
        algorithm: "RS256",
        expiresIn: this.config.crossAppTtlSeconds,
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );

    await this.redis.set(`token:${jti}`, "valid", "EX", this.config.crossAppTtlSeconds);
    return token;
  }

  public async verifyCrossAppToken(token: string): Promise<CrossAppClaims> {
    const payload = jwt.verify(token, this.publicKey, {
      algorithms: ["RS256"],
      issuer: this.config.issuer,
      audience: this.config.audience,
    }) as JwtPayload;

    const jti = payload.jti;
    if (!jti || typeof jti !== "string") {
      throw new Error("Missing jti");
    }

    const key = `token:${jti}`;
    const lua = `
      local value = redis.call("GET", KEYS[1])
      if not value then
        return 0
      end
      redis.call("DEL", KEYS[1])
      return 1
    `;
    const consumed = await this.redis.eval(lua, 1, key);
    if (consumed !== 1) {
      throw new Error("Token already used or expired");
    }

    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role),
      aud: String(payload.aud),
      iss: String(payload.iss),
      jti,
    };
  }
}

