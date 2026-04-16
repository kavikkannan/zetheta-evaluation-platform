import fs from "node:fs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type Redis from "ioredis";
import { HttpError } from "./errors";

export interface UnifiedTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  aud: string;
  iss: string;
  jti?: string;
}

export class TokenVerifier {
  private readonly publicKeyPem: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly redis: Redis;

  public constructor(options: {
    redis: Redis;
    publicKeyPath: string;
    issuer: string;
    audience: string;
  }) {
    this.redis = options.redis;
    this.publicKeyPem = fs.readFileSync(options.publicKeyPath, "utf-8");
    this.issuer = options.issuer;
    this.audience = options.audience;
  }

  public async verifyToken(token: string): Promise<UnifiedTokenPayload> {
    let payload: JwtPayload;
    try {
      const verified = jwt.verify(token, this.publicKeyPem, {
        algorithms: ["RS256"],
        issuer: this.issuer,
        audience: [this.audience, "auth-service"],
      });

      if (typeof verified === "string") {
        throw new Error("Unexpected JWT payload type");
      }

      payload = verified;
    } catch {
      throw new HttpError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }

    const jti = payload.jti;
    const sub = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const role = payload.role;
    const aud = payload.aud as string;
    const iss = payload.iss;

    if (
      !sub || typeof sub !== "string" ||
      !email || typeof email !== "string" ||
      !name || typeof name !== "string" ||
      !role || typeof role !== "string" ||
      !aud || typeof aud !== "string" ||
      !iss || typeof iss !== "string"
    ) {
      throw new HttpError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Token missing required claims",
      });
    }

    const isCrossApp = aud === this.audience;

    if (isCrossApp) {
      if (!jti || typeof jti !== "string") {
        throw new HttpError({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Cross-app token missing jti claim",
        });
      }

      const tokenKey = `token:${jti}`;
      const lua = `
        local value = redis.call("GET", KEYS[1])
        if not value then
          return 0
        end
        redis.call("DEL", KEYS[1])
        return 1
      `;

      let consumed: unknown;
      try {
        consumed = await this.redis.eval(lua, 1, tokenKey);
      } catch {
        throw new HttpError({
          statusCode: 503,
          code: "INTERNAL_ERROR",
          message: "Token validation unavailable (Redis failure)",
        });
      }

      if (consumed !== 1) {
        throw new HttpError({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Token already used or expired",
        });
      }
    }

    return {
      sub,
      email,
      name,
      role,
      aud,
      iss,
      jti,
    };
  }
}

