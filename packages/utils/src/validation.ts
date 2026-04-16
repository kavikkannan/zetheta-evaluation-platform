import { ZodError, ZodSchema } from "zod";

export function parseWithSchema<T>(schema: ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ValidationException(result.error);
  }

  return result.data;
}

export class ValidationException extends Error {
  public readonly details: ZodError;

  public constructor(details: ZodError) {
    super("Payload validation failed");
    this.name = "ValidationException";
    this.details = details;
  }
}
