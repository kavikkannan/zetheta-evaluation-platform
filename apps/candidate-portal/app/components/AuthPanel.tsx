"use client";

import React from "react";
import { useMemo, useState } from "react";
import { buildAssessmentCallbackUrl, requestCrossAppToken, login } from "../../lib/auth-client";
import { env } from "../../lib/env";

const SESSION_TOKEN_KEY = "candidate_portal_session_token";
const SESSION_USER_NAME_KEY = "candidate_portal_user_name";
const DEFAULT_APPLICATION_ID = "123e4567-e89b-12d3-a456-426614174000";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState(DEFAULT_APPLICATION_ID);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useMemo(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    const name = window.sessionStorage.getItem(SESSION_USER_NAME_KEY);
    if (token) {
      setSessionToken(token);
    }
    if (name) {
      setUserName(name);
    }
  }, []);

  async function onLoginSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingLogin(true);

    try {
      const result = await login(email, password);
      setSessionToken(result.accessToken);
      setUserName(result.user.name);
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, result.accessToken);
      window.sessionStorage.setItem(SESSION_USER_NAME_KEY, result.user.name);
      setSuccess("Logged in. You can now start the assessment.");
      setPassword("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Login failed.";
      setError(message);
    } finally {
      setLoadingLogin(false);
    }
  }

  async function onStartAssessment(): Promise<void> {
    if (!sessionToken) {
      setError("Please login before starting assessment.");
      return;
    }

    setLoadingToken(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await requestCrossAppToken(sessionToken, applicationId);
      const callbackUrl = buildAssessmentCallbackUrl(
        env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL,
        result.token,
      );
      window.location.assign(callbackUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not generate handoff token.";
      setError(message);
    } finally {
      setLoadingToken(false);
    }
  }

  return (
    <div className="auth-panel">
      <h2>Candidate Login</h2>
      <p className="muted">
        Authenticate with Auth Service, then generate a one-time cross-app token to launch
        assessment.
      </p>

      <form onSubmit={onLoginSubmit} className="auth-form">
        <label>
          Email
          <input
            aria-label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="candidate@example.com"
            required
          />
        </label>

        <label>
          Password
          <input
            aria-label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <button type="submit" disabled={loadingLogin}>
          {loadingLogin ? "Signing in..." : "Login"}
        </button>
      </form>

      <div className="launch-card">
        <h3>Start Assessment</h3>
        <p className="muted">
          {sessionToken
            ? `Authenticated as ${userName ?? "candidate"}.`
            : "You must login before requesting a handoff token."}
        </p>
        <label>
          Application ID
          <input
            aria-label="Application ID"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
          />
        </label>
        <button type="button" onClick={onStartAssessment} disabled={!sessionToken || loadingToken}>
          {loadingToken ? "Generating token..." : "Start Assessment"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="success">
          {success}
        </p>
      ) : null}
    </div>
  );
}
