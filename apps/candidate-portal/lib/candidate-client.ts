import { apiRequest } from "./api-client";
import type { CandidateFunnelStatus } from "@zetheta/shared-types";

export interface ApplicationStatus {
  applicationId: string;
  status: CandidateFunnelStatus;
  assessmentSessionId: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
}

export interface QuestionResult {
  sequence: number;
  questionText: string;
  options: Array<{ label: string; text: string }>;
  candidateAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface DetailedResults {
  candidateName: string;
  candidateEmail: string;
  score: number;
  maxScore: number;
  percentage: number;
  evaluatedAt: string;
  questions: QuestionResult[];
}

/**
 * Fetch the candidate's application status from the API Gateway.
 * GET /v1/candidates/me/application
 */
export async function fetchMyApplication(
  sessionToken: string,
): Promise<ApplicationStatus> {
  return apiRequest<ApplicationStatus>("/candidates/me/application", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}

/**
 * Fetch the detailed question-by-question results for the candidate.
 * GET /v1/candidates/me/results
 */
export async function fetchMyResults(
  sessionToken: string,
): Promise<DetailedResults> {
  return apiRequest<DetailedResults>("/candidates/me/results", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}
