"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Option {
  label: string;
  text: string;
}

interface Question {
  id: string;
  sequence: number;
  questionText: string;
  options: Option[];
}

interface MCQInterfaceProps {
  questions: Question[];
  applicationId: string;
}

export function MCQInterface({ questions, applicationId }: MCQInterfaceProps) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Proctoring state
  const [violations, setViolations] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Enter Fullscreen
  const enterFullScreen = useCallback(() => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => {
        console.warn("Fullscreen request failed. Most browsers require user interaction first.");
      });
    }
  }, []);

  // Monitor Proctoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations((v) => v + 1);
        setShowWarning(true);
      }
    };

    const handleBlur = () => {
      setViolations((v) => v + 1);
      setShowWarning(true);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (!questions || questions.length === 0) {
    return <div>No questions available for this assessment.</div>;
  }

  const currentQuestion = questions[currentIdx];
  const selectedAnswer = answers[currentQuestion.id];
  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSelect = (label: string) => {
    if (!isFullscreen) enterFullScreen();
    
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: label,
    }));
  };

  const handleNext = () => {
    setError(null);
    if (!selectedAnswer) {
      setError("Please select an answer to continue.");
      return;
    }
    setCurrentIdx((curr) => curr + 1);
  };

  const handlePrev = () => {
    setError(null);
    setCurrentIdx((curr) => Math.max(0, curr - 1));
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) {
      setError("Please select an answer to finish.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    const payload = {
      applicationId,
      responses: Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
      proctoring: {
        tabSwitches: violations,
        fullscreenExits: 0
      }
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit assessment");
      }

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      router.push("/complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mcq-container">
      {/* Warning Modal */}
      {showWarning && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem"
        }}>
          <div style={{
            background: "#161b27", border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "1.5rem", padding: "2rem", maxWidth: "400px", width: "100%", textAlign: "center"
          }}>
            <h3 style={{ color: "#ef4444", marginBottom: "0.5rem", fontSize: "1.25rem", fontWeight: "bold" }}>Proctoring Warning</h3>
            <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>
              Navigation away from the assessment page is recorded. 
            </p>
            <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "0.75rem", borderRadius: "0.75rem", marginBottom: "1.5rem" }}>
              <span style={{ fontWeight: "bold", color: "#f87171" }}>Violations: {violations}</span>
            </div>
            <button 
              className="btn btn--primary" style={{ width: "100%" }}
              onClick={() => {
                setShowWarning(false);
                if (!isFullscreen) enterFullScreen();
              }}
            >
              Continue Assessment
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Required Overlay */}
      {!isFullscreen && !showWarning && currentIdx === 0 && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem"
        }}>
          <div style={{
            background: "#161b27", border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "1.5rem", padding: "2rem", maxWidth: "400px", width: "100%", textAlign: "center"
          }}>
            <h3 style={{ color: "white", marginBottom: "0.5rem", fontSize: "1.25rem", fontWeight: "bold" }}>Secure Assessment Mode</h3>
            <p style={{ color: "#9ca3af", marginBottom: "1.5rem" }}>
              To ensure a fair testing environment, this assessment requires full-screen mode.
            </p>
            <button className="btn btn--primary" style={{ width: "100%" }} onClick={enterFullScreen}>
              Enable Full-Screen
            </button>
          </div>
        </div>
      )}

      <div className="assessment-header">
        <div className="assessment-title">Technical Assessment</div>
        <div className="assessment-progress">
          Question {currentIdx + 1} of {questions.length}
        </div>
      </div>

      <div className="question-card">
        <h3 className="question-text">{currentQuestion.questionText}</h3>
        <div className="options-list">
          {(currentQuestion.options || []).map((opt) => {
            const isSelected = selectedAnswer === opt.label;
            return (
              <button
                key={opt.label}
                className={`option-btn ${isSelected ? "option-btn--selected" : ""}`}
                onClick={() => handleSelect(opt.label)}
                disabled={isSubmitting}
              >
                <span className="option-label">{opt.label}</span>
                <span className="option-text">{opt.text}</span>
              </button>
            );
          })}
        </div>
        
        {error && (
          <div className="form-error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </div>

      <div className="assessment-footer">
        <div>
          {currentIdx > 0 && (
            <button className="btn btn--ghost" onClick={handlePrev} disabled={isSubmitting}>
              Previous
            </button>
          )}
        </div>
        <div>
          {!isLastQuestion ? (
            <button className="btn btn--primary" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button className="btn btn--primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Assessment"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
