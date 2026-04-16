"use client";

import { useState } from "react";
import { login } from "../../lib/auth-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(email, password);
      
      if (result.user.role !== "employer") {
        throw new Error("Only employer accounts can access this dashboard.");
      }

      // Set cookie and redirect
      document.cookie = `e_session=${result.accessToken}; path=/; max-age=28800; samesite=lax`;
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form-wrapper">
      <div className="login-card">
        <span className="login-card__icon" aria-hidden="true">🏢</span>
        <h2 className="login-card__title">Employer Sign In</h2>
        <p className="login-card__subtitle">Access your talent evaluation pipeline.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employer@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="form-error">
              <span className="form-error__icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--full" disabled={isLoading}>
            {isLoading ? (
              <span className="btn__loading">
                <span className="spinner spinner--sm"></span>
                Signing in...
              </span>
            ) : (
              "Sign In to Dashboard"
            )}
          </button>
        </form>

        <div className="login-card__hint">
          <p>Demo access: employer@example.com / password123</p>
        </div>
      </div>
    </div>
  );
}
