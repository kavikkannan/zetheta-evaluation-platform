"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/auth-client";
import { saveSession } from "../../lib/session";
import { getSession } from "../../lib/session";

const DEFAULT_APPLICATION_ID = "123e4567-e89b-12d3-a456-426614174000";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // If already logged in → redirect to dashboard
  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/dashboard");
    } else {
      setChecked(true);
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      saveSession(result.accessToken, result.user, DEFAULT_APPLICATION_ID);
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!checked) {
    return (
      <div className="loading-state" aria-live="polite">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="login-form-wrapper">
      <div className="login-card">
        <div className="login-card__icon" aria-hidden="true">🔐</div>
        <h2 className="login-card__title">Welcome back</h2>
        <p className="login-card__subtitle">Sign in to access your assessment portal</p>

        <form onSubmit={onSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email address</label>
            <input
              id="login-email"
              aria-label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="form-input"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              aria-label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error ? (
            <div role="alert" className="form-error">
              <span className="form-error__icon" aria-hidden="true">⚠️</span>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading || !email || !password}
            id="login-submit-btn"
          >
            {loading ? (
              <span className="btn__loading">
                <span className="spinner spinner--sm" aria-hidden="true" />
                Signing in…
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="login-card__hint">
          Use your registered candidate credentials to sign in.
        </p>
      </div>
    </div>
  );
}
