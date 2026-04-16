"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "../../lib/session";
import { requestCrossAppToken, buildAssessmentCallbackUrl } from "../../lib/auth-client";
import { fetchMyApplication } from "../../lib/candidate-client";
import { env } from "../../lib/env";
import type { SessionData } from "../../lib/session";
import type { CandidateFunnelStatus } from "@zetheta/shared-types";

type AssessmentStatus = CandidateFunnelStatus | "ready";

interface StatusConfig {
  label: string;
  description: string;
  color: string;
  icon: string;
  ctaEnabled: boolean;
  ctaLabel: string;
}

const STATUS_MAP: Record<AssessmentStatus, StatusConfig> = {
  ready: {
    label: "Ready",
    description: "You have not started an assessment yet.",
    color: "status--ready",
    icon: "🟢",
    ctaEnabled: true,
    ctaLabel: "Start Assessment",
  },
  applied: {
    label: "Applied",
    description: "Your application is registered. You can start the assessment.",
    color: "status--applied",
    icon: "📋",
    ctaEnabled: true,
    ctaLabel: "Start Assessment",
  },
  attempted: {
    label: "Submitted",
    description: "Your assessment has been submitted and is being evaluated.",
    color: "status--attempted",
    icon: "⏳",
    ctaEnabled: false,
    ctaLabel: "Awaiting Evaluation",
  },
  evaluated: {
    label: "Evaluated",
    description: "Your assessment has been evaluated. Results are available.",
    color: "status--evaluated",
    icon: "✅",
    ctaEnabled: false,
    ctaLabel: "Assessment Complete",
  },
};

export function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus>("ready");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Route guard & data fetch
  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);

    fetchMyApplication(s.token)
      .then((app) => {
        setAssessmentStatus(app.status);
        // Optionally update session if applicationId in DB differs from session storage
        setSession((prev) => (prev ? { ...prev, applicationId: app.applicationId } : null));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load application status";
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function handleStartAssessment(): Promise<void> {
    if (!session) return;
    setError(null);
    setStarting(true);
    try {
      const result = await requestCrossAppToken(session.token, session.applicationId);
      const callbackUrl = buildAssessmentCallbackUrl(
        env.NEXT_PUBLIC_ASSESSMENT_ENGINE_URL,
        result.token,
      );
      showToast("Redirecting to assessment…");
      // Small delay so toast is visible before navigation
      await new Promise((r) => setTimeout(r, 600));
      window.location.assign(callbackUrl);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not start assessment. Please try again.";
      setError(message);
    } finally {
      setStarting(false);
    }
  }

  function handleLogout(): void {
    clearSession();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="dashboard-loading" aria-live="polite">
        <div className="spinner" aria-label="Loading dashboard" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (!session) return null;

  const statusCfg = STATUS_MAP[assessmentStatus];
  const initial = session.user.name.charAt(0).toUpperCase();

  return (
    <div className="dashboard">
      {/* Toast */}
      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-brand">
          <span className="brand-mark">Z</span>
          <span className="brand-name">Zetheta</span>
        </div>
        <div className="dashboard__header-user">
          <div className="avatar" aria-hidden="true">{initial}</div>
          <div className="user-info">
            <span className="user-name">{session.user.name}</span>
            <span className="user-role">{session.user.role}</span>
          </div>
          <button
            id="logout-btn"
            className="btn btn--ghost btn--sm"
            onClick={handleLogout}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="dashboard__main">
        {/* Welcome hero */}
        <section className="dashboard__hero">
          <div className="dashboard__hero-text">
            <h1 className="dashboard__greeting">Hello, {session.user.name.split(" ")[0]} 👋</h1>
            <p className="dashboard__email">{session.user.email}</p>
          </div>
          <div className={`status-badge ${statusCfg.color}`}>
            <span className="status-badge__icon" aria-hidden="true">{statusCfg.icon}</span>
            <span className="status-badge__label">{statusCfg.label}</span>
          </div>
        </section>

        {/* Assessment card */}
        <section className="assessment-card" aria-labelledby="assessment-card-title">
          <div className="assessment-card__info">
            <h2 id="assessment-card-title" className="assessment-card__title">
              Technical Assessment
            </h2>
            <p className="assessment-card__desc">{statusCfg.description}</p>

            <ul className="assessment-card__meta">
              <li>
                <span className="meta-icon" aria-hidden="true">📝</span>
                Multiple-choice questions
              </li>
              <li>
                <span className="meta-icon" aria-hidden="true">⏱️</span>
                Timed assessment · 30 minutes
              </li>
              <li>
                <span className="meta-icon" aria-hidden="true">🔒</span>
                Single-attempt · cannot be retaken
              </li>
              <li>
                <span className="meta-icon" aria-hidden="true">🔑</span>
                Secure cross-app handoff via RS256 token
              </li>
            </ul>
          </div>

          <div className="assessment-card__action">
            {error ? (
              <div role="alert" className="form-error" style={{ marginBottom: "0.75rem" }}>
                <span className="form-error__icon" aria-hidden="true">⚠️</span>
                {error}
              </div>
            ) : null}

            <button
              id="start-assessment-btn"
              type="button"
              className={`btn btn--primary btn--lg ${!statusCfg.ctaEnabled ? "btn--disabled" : ""}`}
              onClick={handleStartAssessment}
              disabled={!statusCfg.ctaEnabled || starting}
              aria-disabled={!statusCfg.ctaEnabled}
            >
              {starting ? (
                <span className="btn__loading">
                  <span className="spinner spinner--sm" aria-hidden="true" />
                  Generating secure token…
                </span>
              ) : (
                <>
                  <span aria-hidden="true">{statusCfg.ctaEnabled ? "🚀" : "🔒"}</span>
                  {statusCfg.ctaLabel}
                </>
              )}
            </button>

            {!statusCfg.ctaEnabled && assessmentStatus !== "ready" ? (
              <p className="assessment-card__note">
                {assessmentStatus === "attempted"
                  ? "Your responses are being processed by our evaluation pipeline."
                  : "Thank you for completing the assessment. Your employer will be in touch."}
              </p>
            ) : null}
          </div>
        </section>

        {/* Info cards */}
        <section className="info-grid" aria-label="Assessment information">
          <div className="info-card">
            <span className="info-card__icon" aria-hidden="true">🔐</span>
            <h3 className="info-card__title">Secure Handoff</h3>
            <p className="info-card__desc">
              When you start, a short-lived cryptographic token (valid 60 s) is generated and
              passed securely to the assessment engine. It is single-use and cannot be replayed.
            </p>
          </div>
          <div className="info-card">
            <span className="info-card__icon" aria-hidden="true">⚡</span>
            <h3 className="info-card__title">Real-Time Scoring</h3>
            <p className="info-card__desc">
              After submission, your answers are evaluated asynchronously. Your employer's
              dashboard is updated in real time as soon as scoring completes.
            </p>
          </div>
          <div className="info-card">
            <span className="info-card__icon" aria-hidden="true">🛡️</span>
            <h3 className="info-card__title">Fair & Confidential</h3>
            <p className="info-card__desc">
              Correct answers are never exposed on the client. All data is transmitted over
              secure channels and stored in an audited PostgreSQL database.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
