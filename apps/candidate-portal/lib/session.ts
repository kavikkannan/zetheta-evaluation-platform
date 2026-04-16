import type { User } from "@zetheta/shared-types";

export const SESSION_KEYS = {
  TOKEN: "cp_session_token",
  USER: "cp_session_user",
  APPLICATION_ID: "cp_application_id",
} as const;

/** Persist session to sessionStorage (client-only). */
export function saveSession(token: string, user: User, applicationId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEYS.TOKEN, token);
  window.sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
  window.sessionStorage.setItem(SESSION_KEYS.APPLICATION_ID, applicationId);
}

/** Clear all session data. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  Object.values(SESSION_KEYS).forEach((k) => window.sessionStorage.removeItem(k));
}

export interface SessionData {
  token: string;
  user: User;
  applicationId: string;
}

/** Read and validate session from sessionStorage. Returns null if no session. */
export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const token = window.sessionStorage.getItem(SESSION_KEYS.TOKEN);
  const userRaw = window.sessionStorage.getItem(SESSION_KEYS.USER);
  const applicationId = window.sessionStorage.getItem(SESSION_KEYS.APPLICATION_ID);
  if (!token || !userRaw || !applicationId) return null;
  try {
    const user = JSON.parse(userRaw) as User;
    return { token, user, applicationId };
  } catch {
    return null;
  }
}
