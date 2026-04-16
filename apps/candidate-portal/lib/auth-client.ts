import { apiRequest } from "./api-client";

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export interface CrossAppTokenResult {
  token: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      data: { email, password },
    }),
  });
}

export async function requestCrossAppToken(
  sessionToken: string,
  applicationId: string,
): Promise<CrossAppTokenResult> {
  return apiRequest<CrossAppTokenResult>("/auth/token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      data: { applicationId },
    }),
  });
}

export function buildAssessmentCallbackUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`;
}
