export type DbApplicationStatus = "applied" | "attempted" | "evaluated";

export interface DbRole {
  id: string;
  name: string;
  createdAt: Date;
}

export interface DbPermission {
  id: string;
  name: string;
  createdAt: Date;
}

export interface DbCandidate {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbAssessmentSession {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  createdAt: Date;
}

export interface DbMcqQuestion {
  id: string;
  assessmentSessionId: string;
  sequence: number;
  questionText: string;
  options: unknown;
  correctAnswer: string;
  createdAt: Date;
}

export interface DbApplication {
  id: string;
  candidateId: string;
  status: DbApplicationStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbSubmission {
  id: string;
  applicationId: string;
  submittedAt: Date;
  createdAt: Date;
}

export interface DbResponse {
  id: string;
  submissionId: string;
  questionId: string;
  answer: string;
  createdAt: Date;
}

export interface DbScore {
  id: string;
  submissionId: string;
  score: number;
  maxScore: number;
  evaluatedAt: Date;
  workerId: string | null;
  createdAt: Date;
}

