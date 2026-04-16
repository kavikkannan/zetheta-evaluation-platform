import { env } from "./env";

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
}

export interface ApiSuccessEnvelope<TData> {
  status: "success";
  data: TData;
}

export interface ApiErrorEnvelope {
  status: "error";
  error: ApiErrorPayload;
}

export type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly requestId?: string;

  public constructor(error: ApiErrorPayload) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

export function parseApiEnvelope<TData>(payload: ApiEnvelope<TData>): TData {
  if (payload.status === "error") {
    throw new ApiClientError(payload.error);
  }

  return payload.data;
}

export async function apiRequest<TData>(
  path: string,
  init?: RequestInit,
): Promise<TData> {
  const baseUrl = env.API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const envelope = (await response.json()) as ApiEnvelope<TData>;
  return parseApiEnvelope(envelope);
}
