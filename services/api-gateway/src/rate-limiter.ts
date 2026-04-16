import type Redis from "ioredis";
import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "./errors";

type KeyFn = (req: FastifyRequest) => string;

export function createRedisRateLimitPreHandler(options: {
  redis: Redis;
  limitPerWindow: number;
  windowSeconds: number;
  keyPrefix: string;
  keyFn: KeyFn;
}) {
  const { redis, limitPerWindow, windowSeconds, keyPrefix, keyFn } = options;

  const lua = `
    local count = redis.call("INCR", KEYS[1])
    if count == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end
    local ttl = redis.call("TTL", KEYS[1])
    return {count, ttl}
  `;

  return async function rateLimitPreHandler(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const key = `${keyPrefix}:${keyFn(req)}`;

    let result: unknown;
    try {
      result = await redis.eval(lua, 1, key, windowSeconds);
    } catch {
      // Fail open for rate limiting if Redis is unavailable.
      return;
    }

    const [countRaw, ttlRaw] = Array.isArray(result) ? result : [];
    const count = Number(countRaw);
    const ttlSeconds = Math.max(0, Number(ttlRaw));

    if (!Number.isFinite(count) || !Number.isFinite(ttlSeconds)) {
      return;
    }

    if (count > limitPerWindow) {
      reply.header("Retry-After", String(ttlSeconds || windowSeconds));
      throw new HttpError({
        statusCode: 429,
        code: "RATE_LIMITED",
        message: "Rate limit exceeded",
      });
    }
  };
}

