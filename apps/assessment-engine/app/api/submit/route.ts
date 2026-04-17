import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "../../../lib/env";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("ae_session");

  if (!sessionCookie) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const internalToken = `engine_${sessionCookie.value}`;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Forward submission to API Gateway
  const baseUrl = env.API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL;
  const res = await fetch(`${baseUrl}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionCookie.value}`,
      "x-internal-token": env.INTERNAL_TOKEN_SECRET,
    },
    body: JSON.stringify({ data: body }),
  });

  if (!res.ok) {
    let errorMsg = "Submission failed";
    try {
      const errorData = await res.json();
      errorMsg = errorData.error?.message || errorMsg;
    } catch {}
    return NextResponse.json({ error: errorMsg }, { status: res.status });
  }

  // Clear session after successful submission to prevent resubmission
  cookieStore.delete("ae_session");

  const responseData = await res.json();
  return NextResponse.json(responseData, { status: 202 });
}
