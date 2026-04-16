import { Job, UnrecoverableError } from "bullmq";
import { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import pino from "pino";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

export interface EvaluationJobData {
  submissionId: string;
  userId: string;
  queuedAt: string;
}

export class EvaluationProcessor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisPubSub: Redis,
    private readonly workerId: string,
  ) {}

  public async process(job: Job<EvaluationJobData>): Promise<{ scoreId?: string; duplicate?: boolean; score?: number }> {
    const { submissionId } = job.data;
    
    logger.info({ submissionId, jobId: job.id }, "Processing evaluation job");

    try {
      // 1. Idempotency Check
      const existingScore = await this.prisma.score.findUnique({
        where: { submissionId },
      });

      if (existingScore) {
        logger.info({ submissionId, scoreId: existingScore.id }, "Submission already evaluated. Skipping duplicate compute.");
        return { scoreId: existingScore.id, duplicate: true, score: existingScore.score };
      }

      // 2. Fetch Submission and Responses
      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          responses: {
            include: { mcqQuestion: true },
          },
          application: true,
        },
      });

      if (!submission) {
        logger.error({ submissionId }, "Submission not found in database");
        // Permanent error - fail job immediately (no retry)
        throw new UnrecoverableError("Submission not found in database");
      }

      // Determine max score dynamically based on the session ID of the first response,
      // or global total questions if no responses exist (assumes MVP single-assessment design).
      let maxScore = 0;
      if (submission.responses.length > 0) {
        const assessmentSessionId = submission.responses[0].mcqQuestion.assessmentSessionId;
        maxScore = await this.prisma.mcqQuestion.count({
          where: { assessmentSessionId },
        });
      } else {
        maxScore = await this.prisma.mcqQuestion.count();
      }

      // 3. Compute Score
      let scoreVal = 0;
      for (const response of submission.responses) {
        if (response.answer === response.mcqQuestion.correctAnswer) {
          scoreVal += 1;
        }
      }

      // 4. Persist Score
      const scoreRecord = await this.prisma.score.create({
        data: {
          submissionId,
          score: scoreVal,
          maxScore,
          workerId: this.workerId,
        },
      });

      logger.info({ submissionId, scoreId: scoreRecord.id, score: scoreVal, maxScore }, "Score calculated and saved");

      // 5. Publish Event
      const eventPayload = {
        submissionId,
        score: scoreVal,
        maxScore,
        evaluatedAt: scoreRecord.evaluatedAt.toISOString(),
      };

      await this.redisPubSub.publish("score:ready", JSON.stringify(eventPayload));
      logger.info({ submissionId, event: "score:ready" }, "Published score:ready event");

      return { scoreId: scoreRecord.id, duplicate: false, score: scoreVal };
    } catch (error) {
      if (error instanceof UnrecoverableError) {
        throw error;
      }
      
      // Transient Errors (timeouts, redis disconnects) should throw normal errors to trigger BullMQ retry
      logger.error({ submissionId, err: error }, "Transient error processing evaluation job");
      throw error;
    }
  }
}
