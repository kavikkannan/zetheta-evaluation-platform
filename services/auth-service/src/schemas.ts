import { z } from "zod";

export const loginRequestSchema = z.object({
  data: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const tokenRequestSchema = z.object({
  data: z.object({
    applicationId: z.string().uuid(),
  }),
});

export const verifyRequestSchema = z.object({
  data: z.object({
    token: z.string().min(1),
  }),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type TokenRequest = z.infer<typeof tokenRequestSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

