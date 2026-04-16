import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

const loginMock = vi.fn();
const requestTokenMock = vi.fn();
const buildCallbackUrlMock = vi.fn((baseUrl: string, token: string) =>
  `${baseUrl}/auth/callback?token=${encodeURIComponent(token)}`,
);

vi.mock("../../lib/auth-client", () => ({
  login: (...args: unknown[]) => loginMock(...args),
  requestCrossAppToken: (...args: unknown[]) => requestTokenMock(...args),
  buildAssessmentCallbackUrl: (...args: unknown[]) => buildCallbackUrlMock(...args),
}));

vi.mock("../../lib/env", () => ({
  env: {
    NEXT_PUBLIC_ASSESSMENT_ENGINE_URL: "http://localhost:4002",
  },
}));

describe("AuthPanel", () => {
  beforeEach(() => {
    loginMock.mockReset();
    requestTokenMock.mockReset();
    buildCallbackUrlMock.mockClear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows login success state and enables start assessment", async () => {
    loginMock.mockResolvedValue({
      accessToken: "session-token",
      user: { id: "1", email: "a@b.com", role: "candidate", name: "Jane" },
    });

    render(<AuthPanel />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password@123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Logged in. You can now start the assessment.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start Assessment" })).toBeEnabled();
  });

  it("shows login failure error state", async () => {
    loginMock.mockRejectedValue(new Error("Invalid credentials"));
    render(<AuthPanel />);

    await userEvent.type(screen.getByLabelText("Email"), "wrong@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("blocks unauthenticated start assessment", async () => {
    render(<AuthPanel />);
    expect(screen.getByRole("button", { name: "Start Assessment" })).toBeDisabled();
    expect(
      screen.getByText("You must login before requesting a handoff token."),
    ).toBeVisible();
  });

  it("requests cross-app token and redirects with token in URL", async () => {
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      assign: vi.fn(),
    } as unknown as Location);

    loginMock.mockResolvedValue({
      accessToken: "session-token",
      user: { id: "1", email: "candidate@example.com", role: "candidate", name: "Jane" },
    });
    requestTokenMock.mockResolvedValue({
      token: "cross.app.token",
      expiresIn: 60,
    });

    render(<AuthPanel />);
    await userEvent.type(screen.getByLabelText("Email"), "candidate@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password@123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByText("Logged in. You can now start the assessment.");

    await userEvent.click(screen.getByRole("button", { name: "Start Assessment" }));

    expect(requestTokenMock).toHaveBeenCalledTimes(1);
    expect(buildCallbackUrlMock).toHaveBeenCalledWith("http://localhost:4002", "cross.app.token");
    locationSpy.mockRestore();
  });
});
