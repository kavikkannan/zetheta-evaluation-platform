import { z } from "zod";

export const authLoginRequestSchema = z.object({
  data: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const authTokenRequestSchema = z.object({
  data: z.object({
    applicationId: z.string().uuid(),
  }),
});

export const authVerifyRequestSchema = z.object({
  data: z.object({
    token: z.string().min(1),
  }),
});

export const assessmentQuestionsParamsSchema = z.object({
  assessmentId: z.string().uuid(),
});

export const scoresParamsSchema = z.object({
  submissionId: z.string().uuid(),
});

export const submissionsRequestSchema = z.object({
  data: z.object({
    applicationId: z.string().uuid(),
    responses: z
      .array(
        z.object({
          questionId: z.string().uuid(),
          answer: z.string().min(1).max(10),
        }),
      )
      .min(1),
  }),
});

export const dashboardCandidatesQuerySchema = z.object({
  status: z
    .enum(["applied", "attempted", "evaluated"])
    .optional()
    .transform((v) => v),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

