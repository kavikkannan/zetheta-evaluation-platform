"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "../../lib/session";
import { requestCrossAppToken, buildAssessmentCallbackUrl } from "../../lib/auth-client";
import { fetchMyApplication, fetchMyResults } from "../../lib/candidate-client";
import type { DetailedResults } from "../../lib/candidate-client";
import { env } from "../../lib/env";
import { useWebSocket, WSMessage } from "../../lib/useWebSocket";
import type { SessionData } from "../../lib/session";
import type { CandidateFunnelStatus } from "@zetheta/shared-types";

type AssessmentStatus = CandidateFunnelStatus | "ready";

interface StatusConfig {
  label: string;
  description: string;
  color: string;
  ctaEnabled: boolean;
  ctaLabel: string;
}

const STATUS_MAP: Record<AssessmentStatus, StatusConfig> = {
  ready: {
    label: "Ready",
    description: "You have not started an assessment yet.",
    color: "status--ready",
    ctaEnabled: true,
    ctaLabel: "Start Assessment",
  },
  applied: {
    label: "Applied",
    description: "Your application is registered. You can start the assessment.",
    color: "status--applied",
    ctaEnabled: true,
    ctaLabel: "Start Assessment",
  },
  attempted: {
    label: "Submitted",
    description: "Your assessment has been submitted and is being evaluated.",
    color: "status--attempted",
    ctaEnabled: false,
    ctaLabel: "Awaiting Evaluation",
  },
  evaluated: {
    label: "Evaluated",
    description: "Your assessment has been evaluated. Results are available below.",
    color: "status--evaluated",
    ctaEnabled: false,
    ctaLabel: "Assessment Complete",
  },
};

export function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus>("ready");
  const [score, setScore] = useState<number | null>(null);
  const [maxScore, setMaxScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detailedResults, setDetailedResults] = useState<DetailedResults | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Real-time updates
  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "SCORE_READY") {
      const payload = msg.payload;
      if (session && (payload.candidateId === session.user.id || payload.email === session.user.email)) {
        setAssessmentStatus("evaluated");
        setScore(payload.score);
        setMaxScore(payload.maxScore);
        showToast("Assessment evaluated successfully!");
      }
    }
  }, [session, showToast]);

  useWebSocket(handleWSMessage, session?.token);

  useEffect(() => {
    setMounted(true);
    const s = getSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);

    fetchMyApplication(s.token)
      .then((app) => {
        setAssessmentStatus(app.status);
        setScore(app.score);
        setMaxScore(app.maxScore);
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
      showToast("Redirecting to assessment...");
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

  async function handleViewDetails(): Promise<void> {
    if (!session) return;
    setLoadingResults(true);
    try {
      const results = await fetchMyResults(session.token);
      setDetailedResults(results);
      setShowResultsModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load results";
      setError(msg);
    } finally {
      setLoadingResults(false);
    }
  }

  function handleLogout(): void {
    clearSession();
    router.replace("/");
  }

  if (loading || !mounted) {
    return (
      <div className="dashboard-loading" aria-live="polite">
        <div className="spinner" aria-label="Loading dashboard" />
        <p>Loading your dashboard...</p>
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

      {/* Results Modal */}
      {showResultsModal && detailedResults ? (
        <ResultsModal
          results={detailedResults}
          onClose={() => setShowResultsModal(false)}
        />
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
            <h1 className="dashboard__greeting">Hello, {session.user.name.split(" ")[0]}</h1>
            <p className="dashboard__email">{session.user.email}</p>
          </div>
          <div className={`status-badge ${statusCfg.color}`}>
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
              <li>Multiple-choice questions</li>
              <li>Timed assessment - 30 minutes</li>
              <li>Single-attempt - cannot be retaken</li>
            </ul>
          </div>

          <div className="assessment-card__action">
            {error ? (
              <div role="alert" className="form-error" style={{ marginBottom: "0.75rem" }}>
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
                  Starting...
                </span>
              ) : (
                statusCfg.ctaLabel
              )}
            </button>

            {!statusCfg.ctaEnabled && assessmentStatus !== "ready" ? (
              <p className="assessment-card__note">
                {assessmentStatus === "attempted"
                  ? "Your responses are being processed by our evaluation pipeline."
                  : "Thank you for completing the assessment. Your score is now recorded."}
              </p>
            ) : null}
          </div>
        </section>

        {/* Results Table */}
        {assessmentStatus === "evaluated" || assessmentStatus === "attempted" ? (
          <section className="dashboard-results-section" style={{ marginTop: "2rem" }}>
            <h2 className="section-title" style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "700" }}>Assessment History</h2>
            <div className="results-table-container" style={{ 
              background: "var(--color-surface)", 
              border: "1px solid var(--color-border)", 
              borderRadius: "var(--radius-lg)",
              overflow: "hidden"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--color-border)" }}>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>Test Name</th>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", textAlign: "center" }}>Result</th>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "1.25rem 1.5rem", fontWeight: "600" }}>Technical Assessment</td>
                    <td style={{ padding: "1.25rem 1.5rem" }}>
                      <span style={{ 
                        padding: "0.25rem 0.75rem", 
                        borderRadius: "var(--radius-full)", 
                        fontSize: "0.75rem", 
                        fontWeight: "700",
                        background: assessmentStatus === "evaluated" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                        color: assessmentStatus === "evaluated" ? "#4ade80" : "#fbbf24",
                        border: assessmentStatus === "evaluated" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(245,158,11,0.2)"
                      }}>
                        {assessmentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center" }}>
                      {assessmentStatus === "evaluated" ? (
                        <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--color-primary)" }}>
                          {score} / {maxScore}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "var(--color-text-faint)", fontStyle: "italic" }}>Calculating...</span>
                      )}
                    </td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "right" }}>
                      {assessmentStatus === "evaluated" ? (
                        <button
                          type="button"
                          onClick={handleViewDetails}
                          disabled={loadingResults}
                          style={{
                            padding: "0.4rem 1rem",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-primary)",
                            background: "transparent",
                            color: "var(--color-primary)",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {loadingResults ? "Loading..." : "View Details"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-faint)" }}>--</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

/* ── Results Modal ────────────────────────────────────────────────── */

function ResultsModal({ results, onClose }: { results: DetailedResults; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-surface, #1a1d2e)", border: "1px solid var(--color-border, #2a2d3e)",
        borderRadius: "1rem", width: "90%", maxWidth: "700px", maxHeight: "85vh",
        overflow: "auto", padding: "2rem",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", margin: 0 }}>Detailed Results</h2>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid var(--color-border, #2a2d3e)",
            color: "var(--color-text-muted, #999)", borderRadius: "0.5rem",
            padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.85rem",
          }}>Close</button>
        </div>

        {/* Score Summary */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem",
        }}>
          <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#818cf8" }}>{results.score}/{results.maxScore}</div>
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>Score</div>
          </div>
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#4ade80" }}>{results.percentage}%</div>
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>Percentage</div>
          </div>
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#fbbf24" }}>{results.questions.filter(q => q.isCorrect).length}</div>
            <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>Correct</div>
          </div>
        </div>

        {/* Questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {results.questions.map((q) => (
            <div key={q.sequence} style={{
              border: `1px solid ${q.isCorrect ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: "0.75rem", padding: "1.25rem",
              background: q.isCorrect ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontWeight: "700", fontSize: "0.9rem" }}>Question {q.sequence}</span>
                <span style={{
                  padding: "0.15rem 0.6rem", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: "700",
                  background: q.isCorrect ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: q.isCorrect ? "#4ade80" : "#f87171",
                  border: `1px solid ${q.isCorrect ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}>{q.isCorrect ? "CORRECT" : "WRONG"}</span>
              </div>
              <p style={{ marginBottom: "0.75rem", lineHeight: "1.5", fontSize: "0.95rem" }}>{q.questionText}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {(q.options || []).map((opt) => {
                  const isCandidate = opt.label === q.candidateAnswer;
                  const isCorrect = opt.label === q.correctAnswer;
                  let bg = "rgba(255,255,255,0.03)";
                  let borderColor = "rgba(255,255,255,0.08)";
                  let textColor = "#ccc";
                  if (isCorrect) { bg = "rgba(34,197,94,0.1)"; borderColor = "rgba(34,197,94,0.4)"; textColor = "#4ade80"; }
                  if (isCandidate && !isCorrect) { bg = "rgba(239,68,68,0.1)"; borderColor = "rgba(239,68,68,0.4)"; textColor = "#f87171"; }
                  return (
                    <div key={opt.label} style={{
                      padding: "0.6rem 0.8rem", borderRadius: "0.5rem",
                      border: `1px solid ${borderColor}`, background: bg, fontSize: "0.85rem", color: textColor,
                    }}>
                      <strong>{opt.label}.</strong> {opt.text}
                      {isCorrect ? <span style={{ float: "right", fontSize: "0.7rem" }}>Correct</span> : null}
                      {isCandidate && !isCorrect ? <span style={{ float: "right", fontSize: "0.7rem" }}>Your answer</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
