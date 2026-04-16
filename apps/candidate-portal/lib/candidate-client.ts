import { apiRequest } from "./api-client";
import type { CandidateFunnelStatus } from "@zetheta/shared-types";

export interface ApplicationStatus {
  applicationId: string;
  status: CandidateFunnelStatus;
  assessmentSessionId: string;
  submittedAt: string | null;
}

/**
 * Fetch the candidate's application status from the API Gateway.
 * GET /v1/candidates/me/application — returns the active application.
 */
export async function fetchMyApplication(
  sessionToken: string,
): Promise<ApplicationStatus> {
  return apiRequest<ApplicationStatus>("/candidates/me/application", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
}
