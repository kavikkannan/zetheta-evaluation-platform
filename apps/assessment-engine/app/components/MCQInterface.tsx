"use client";

import React, { useState } from "react";
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

  if (!questions || questions.length === 0) {
    return <div>No questions available for this assessment.</div>;
  }

  const currentQuestion = questions[currentIdx];
  const selectedAnswer = answers[currentQuestion.id];
  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSelect = (label: string) => {
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

      router.push("/complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="assessment-header">
        <div className="assessment-title">Technical Assessment</div>
        <div className="assessment-progress">
          Question {currentIdx + 1} of {questions.length}
        </div>
      </div>

      <div className="question-card">
        <h3 className="question-text">{currentQuestion.questionText}</h3>
        <div className="options-list">
          {currentQuestion.options.map((opt) => {
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
            <span className="form-error__icon">⚠️</span>
            {error}
          </div>
        )}
      </div>

      <div className="assessment-footer">
        <div>
          {currentIdx > 0 && (
            <button 
              className="btn btn--ghost" 
              onClick={handlePrev} 
              disabled={isSubmitting}
            >
              Previous
            </button>
          )}
        </div>
        <div>
          {!isLastQuestion ? (
            <button 
              className="btn btn--primary" 
              onClick={handleNext}
            >
              Next
            </button>
          ) : (
            <button 
              className="btn btn--primary" 
              onClick={handleSubmit} 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn__loading"><span className="spinner spinner--sm"></span> Submitting...</span>
              ) : (
                "Submit Assessment"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
