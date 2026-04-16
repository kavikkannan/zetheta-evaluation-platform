export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(options: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "HttpError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

