import { NextRequest, NextResponse } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";
import fs from "node:fs";
import { redis } from "../../../lib/redis";
import { env } from "../../../lib/env";

interface CrossAppClaims extends JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  aud: string;
  iss: string;
  jti: string;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "1st Use: Token missing" },
      { status: 401 }
    );
  }

  let publicKeyPem: string;
  try {
    publicKeyPem = fs.readFileSync(env.JWT_PUBLIC_KEY_PATH, "utf-8");
  } catch (err) {
    console.error("Failed to read JWT public key", err);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let payload: CrossAppClaims;
  try {
    const verified = jwt.verify(token, publicKeyPem, {
      algorithms: ["RS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    payload = verified as CrossAppClaims;
  } catch (err) {
    console.error("JWT verification failed:", err);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const jti = payload.jti;
  if (!jti || typeof jti !== "string") {
    return NextResponse.json(
      { error: "Token missing required claims" },
      { status: 401 }
    );
  }

  try {
    const tokenKey = `token:${jti}`;
    const lua = `
      local value = redis.call("GET", KEYS[1])
      if not value then
        return 0
      end
      redis.call("DEL", KEYS[1])
      return 1
    `;
    const consumed = await redis.eval(lua, 1, tokenKey);

    if (consumed !== 1) {
      return NextResponse.json(
        { error: "Token already used or expired" },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error("Redis operation failed:", err);
    return NextResponse.json(
      { error: "Validation service unavailable" },
      { status: 503 }
    );
  }

  // Token is verified and consumed! Create our local session.
  // The local session cookie contains the payload encoded as base64, preserving `sub` and `role`.
  const sessionData = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
  const sessionString = Buffer.from(JSON.stringify(sessionData)).toString("base64");

  // Redirect to assessment (we will fetch the active assessment internally)
  const host = request.headers.get("host") || "localhost:4002";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const assessmentUrl = new URL("/assessment", `${protocol}://${host}`);
  
  const response = NextResponse.redirect(assessmentUrl, 302);
  response.cookies.set("ae_session", sessionString, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 hours
  });

  return response;
}
