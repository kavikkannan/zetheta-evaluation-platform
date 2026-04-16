import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";
import type { SessionData } from "../../lib/session";

/* ---- Mock next/navigation ---- */
const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

/* ---- Mock session helpers ---- */
const mockGetSession = vi.fn<[], SessionData | null>();
const mockClearSession = vi.fn();
vi.mock("../../lib/session", () => ({
  getSession: () => mockGetSession(),
  clearSession: () => mockClearSession(),
}));

/* ---- Mock auth-client ---- */
const mockRequestCrossAppToken = vi.fn();
const mockBuildAssessmentCallbackUrl = vi.fn(
  (base: string, token: string) => `${base}/auth/callback?token=${token}`,
);
vi.mock("../../lib/auth-client", () => ({
  requestCrossAppToken: (...args: unknown[]) => mockRequestCrossAppToken(...args),
  buildAssessmentCallbackUrl: (...args: unknown[]) => mockBuildAssessmentCallbackUrl(...args),
}));

/* ---- Mock candidate-client ---- */
const mockFetchMyApplication = vi.fn();
vi.mock("../../lib/candidate-client", () => ({
  fetchMyApplication: (...args: unknown[]) => mockFetchMyApplication(...args),
}));

/* ---- Mock env ---- */
vi.mock("../../lib/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001/v1",
    NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: "http://localhost:4002",
  },
}));

const MOCK_SESSION: SessionData = {
  token: "session-jwt",
  applicationId: "app-uuid-123",
  user: { id: "user-1", email: "jane@example.com", name: "Jane Doe", role: "candidate" },
};

describe("Dashboard", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockClearSession.mockReset();
    mockRequestCrossAppToken.mockReset();
    mockFetchMyApplication.mockReset();
    mockFetchMyApplication.mockResolvedValue({
      applicationId: "app-uuid-123",
      status: "applied",
      assessmentSessionId: "session-uuid-456",
      submittedAt: null,
    });
    mockReplace.mockReset();
    mockPush.mockReset();
  });

  it("redirects to / when no session exists", () => {
    mockGetSession.mockReturnValue(null);
    render(<Dashboard />);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("renders candidate name and email when session is present", async () => {
    mockGetSession.mockReturnValue(MOCK_SESSION);
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Hello, Jane/)).toBeVisible();
    });
    expect(screen.getByText("jane@example.com")).toBeVisible();
  });

  it("renders Start Assessment button enabled for 'applied' status", async () => {
    mockGetSession.mockReturnValue(MOCK_SESSION);
    render(<Dashboard />);
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Start Assessment/i });
      expect(btn).toBeEnabled();
    });
  });

  it("calls requestCrossAppToken and navigates on Start Assessment click", async () => {
    mockGetSession.mockReturnValue(MOCK_SESSION);
    mockRequestCrossAppToken.mockResolvedValue({ token: "cross-app-jwt", expiresIn: 60 });

    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      assign: vi.fn(),
    } as unknown as Location);

    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Assessment/i })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: /Start Assessment/i }));

    await waitFor(() => {
      expect(mockRequestCrossAppToken).toHaveBeenCalledWith("session-jwt", "app-uuid-123");
    });
    expect(mockBuildAssessmentCallbackUrl).toHaveBeenCalledWith(
      "http://localhost:4002",
      "cross-app-jwt",
    );
    locationSpy.mockRestore();
  });

  it("shows error message when token generation fails", async () => {
    mockGetSession.mockReturnValue(MOCK_SESSION);
    mockRequestCrossAppToken.mockRejectedValue(new Error("Token service unavailable"));
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Assessment/i })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: /Start Assessment/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Token service unavailable");
  });

  it("clears session and redirects on logout", async () => {
    mockGetSession.mockReturnValue(MOCK_SESSION);
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign out/i })).toBeVisible();
    });
    await userEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(mockClearSession).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
