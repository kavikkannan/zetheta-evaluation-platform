import { describe, expect, it } from "vitest";
import { buildAssessmentCallbackUrl } from "./auth-client";

describe("buildAssessmentCallbackUrl", () => {
  it("encodes token into assessment callback URL", () => {
    const url = buildAssessmentCallbackUrl("http://localhost:4002", "abc.def/ghi");
    expect(url).toBe("http://localhost:4002/auth/callback?token=abc.def%2Fghi");
  });
});

