import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluationProcessor } from "./processor";
import { UnrecoverableError } from "bullmq";

const mockFindUniqueScore = vi.fn();
const mockCreateScore = vi.fn();
const mockFindUniqueSubmission = vi.fn();
const mockCountMcq = vi.fn();

const mockPrisma = {
  score: {
    findUnique: mockFindUniqueScore,
    create: mockCreateScore,
  },
  submission: {
    findUnique: mockFindUniqueSubmission,
  },
  mcqQuestion: {
    count: mockCountMcq,
  },
} as any;

const mockPublish = vi.fn();
const mockRedis = {
  publish: mockPublish,
} as any;

describe("EvaluationProcessor", () => {
  let processor: EvaluationProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new EvaluationProcessor(mockPrisma, mockRedis, "test-worker-1");
  });

  it("skips if score already exists (idempotency)", async () => {
    mockFindUniqueScore.mockResolvedValueOnce({ id: "score-123", score: 10 });
    
    const result = await processor.process({ data: { submissionId: "sub-1" } } as any);
    
    expect(result.duplicate).toBe(true);
    expect(result.scoreId).toBe("score-123");
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("throws UnrecoverableError if submission not found", async () => {
    mockFindUniqueScore.mockResolvedValueOnce(null);
    mockFindUniqueSubmission.mockResolvedValueOnce(null);
    
    await expect(
      processor.process({ data: { submissionId: "sub-2" } } as any)
    ).rejects.toThrow(UnrecoverableError);
  });

  it("calculates score correctly and publishes event", async () => {
    mockFindUniqueScore.mockResolvedValueOnce(null);
    mockFindUniqueSubmission.mockResolvedValueOnce({
      id: "sub-3",
      responses: [
        { answer: "A", mcqQuestion: { correctAnswer: "A", assessmentSessionId: "session-1" } },
        { answer: "B", mcqQuestion: { correctAnswer: "C", assessmentSessionId: "session-1" } },
      ],
    });
    mockCountMcq.mockResolvedValueOnce(3); // 3 total questions
    mockCreateScore.mockResolvedValueOnce({
      id: "score-3",
      evaluatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await processor.process({ data: { submissionId: "sub-3" } } as any);

    expect(result.duplicate).toBe(false);
    expect(result.score).toBe(1); // 1 out of 3 correct
    expect(result.scoreId).toBe("score-3");

    expect(mockCreateScore).toHaveBeenCalledWith({
      data: {
        submissionId: "sub-3",
        score: 1,
        maxScore: 3,
        workerId: "test-worker-1",
      },
    });

    expect(mockPublish).toHaveBeenCalledWith(
      "score:ready",
      expect.stringContaining('"score":1,"maxScore":3')
    );
  });
});
