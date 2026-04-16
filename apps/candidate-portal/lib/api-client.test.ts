import { describe, expect, it } from "vitest";
import { ApiClientError, parseApiEnvelope } from "./api-client";

describe("parseApiEnvelope", () => {
  it("returns data for success envelope", () => {
    const data = parseApiEnvelope({
      status: "success",
      data: { id: "123", name: "sample" },
    });

    expect(data).toEqual({ id: "123", name: "sample" });
  });

  it("throws ApiClientError for error envelope", () => {
    expect(() =>
      parseApiEnvelope({
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "Missing credentials",
          requestId: "req-1",
        },
      }),
    ).toThrow(ApiClientError);
  });
});
