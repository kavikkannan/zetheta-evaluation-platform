import { apiRequest } from "./api-client";
import type { UserRole } from "@zetheta/shared-types";

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      data: { email, password },
    }),
  });
}
