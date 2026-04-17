import { Job, UnrecoverableError } from "bullmq";
import { PrismaClient } from "@zetheta/database-client";
import type Redis from "ioredis";
import pino from "pino";
import { Counter, Histogram } from "prom-client";

const evaluationTotal = new Counter({
  name: "evaluation_worker_jobs_total",
  help: "Total number of evaluation jobs",
  labelNames: ["status"],
});

const evaluationDuration = new Histogram({
  name: "evaluation_worker_duration_seconds",
  help: "Duration of evaluation jobs in seconds",
  labelNames: ["status"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const logger = pino({
  level: "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: { colorize: true },
  } : undefined,
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
    const end = evaluationDuration.startTimer();
    
    logger.info({ submissionId, jobId: job.id }, "Processing evaluation job");

    try {
      // 1. Idempotency Check
      const existingScore = await this.prisma.score.findUnique({
        where: { submissionId },
      });

      if (existingScore) {
        logger.info({ submissionId, scoreId: existingScore.id }, "Submission already evaluated. Skipping duplicate compute.");
        evaluationTotal.inc({ status: "duplicate" });
        end({ status: "duplicate" });
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

      // 4. Persist Score & update application status atomically
      const [scoreRecord] = await this.prisma.$transaction([
        this.prisma.score.create({
          data: {
            submissionId,
            score: scoreVal,
            maxScore,
            workerId: this.workerId,
          },
        }),
        this.prisma.application.update({
          where: { id: submission.applicationId },
          data: { status: "evaluated" },
        }),
      ]);

      logger.info({ submissionId, scoreId: scoreRecord.id, score: scoreVal, maxScore }, "Score calculated, saved, and application marked as evaluated");

      // 5. Publish Event
      const eventPayload = {
        submissionId,
        candidateId: submission.application.candidateId,
        score: scoreVal,
        maxScore,
        evaluatedAt: scoreRecord.evaluatedAt.toISOString(),
      };

      await this.redisPubSub.publish("score:ready", JSON.stringify(eventPayload));
      logger.info({ submissionId, event: "score:ready" }, "Published score:ready event");

      evaluationTotal.inc({ status: "success" });
      end({ status: "success" });
      return { scoreId: scoreRecord.id, duplicate: false, score: scoreVal };
    } catch (error) {
      if (error instanceof UnrecoverableError) {
        evaluationTotal.inc({ status: "unrecoverable" });
        end({ status: "unrecoverable" });
        throw error;
      }
      
      // Transient Errors (timeouts, redis disconnects) should throw normal errors to trigger BullMQ retry
      logger.error({ submissionId, err: error }, "Transient error processing evaluation job");
      evaluationTotal.inc({ status: "failure" });
      end({ status: "failure" });
      throw error;
    }
  }
}
