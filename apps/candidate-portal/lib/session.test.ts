import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, clearSession, getSession } from "./session";
import type { User } from "@zetheta/shared-types";

const mockUser: User = {
  id: "user-1",
  email: "jane@example.com",
  name: "Jane Doe",
  role: "candidate",
};

describe("session helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("saves and retrieves a session", () => {
    saveSession("token-abc", mockUser, "app-id-123");
    const session = getSession();
    expect(session).not.toBeNull();
    expect(session?.token).toBe("token-abc");
    expect(session?.applicationId).toBe("app-id-123");
    expect(session?.user.email).toBe("jane@example.com");
  });

  it("returns null when no session is stored", () => {
    expect(getSession()).toBeNull();
  });

  it("returns null after clearing session", () => {
    saveSession("token-abc", mockUser, "app-id-123");
    clearSession();
    expect(getSession()).toBeNull();
  });

  it("returns null when user JSON is corrupt", () => {
    window.sessionStorage.setItem("cp_session_token", "tok");
    window.sessionStorage.setItem("cp_session_user", "not-valid-json{{{");
    window.sessionStorage.setItem("cp_application_id", "app-id");
    expect(getSession()).toBeNull();
  });
});
