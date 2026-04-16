export type UserRole = "candidate" | "employer" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface McqOption {
  label: string;
  text: string;
}

export interface CandidateResponse {
  questionId: string;
  answer: string;
}

export interface Submission {
  id: string;
  applicationId: string;
  candidateId: string;
  responses: CandidateResponse[];
  submittedAt: string;
}

export interface Score {
  submissionId: string;
  score: number;
  maxScore: number;
  evaluatedAt: string;
  workerId?: string;
}

export type CandidateFunnelStatus = "applied" | "attempted" | "evaluated";
