/**
 * Every error the API deliberately returns is an AppError.
 * The global error middleware turns it into the single error shape the
 * frontend's shared service understands.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    message: string,
    options: { statusCode?: number; code?: string; details?: unknown; expose?: boolean } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
    this.expose = options.expose ?? this.statusCode < 500;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 400, code: 'BAD_REQUEST', details });
  }

  static notFound(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 404, code: 'NOT_FOUND', details });
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 409, code: 'CONFLICT', details });
  }

  static validation(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 422, code: 'VALIDATION_ERROR', details });
  }

  static upstream(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 502, code: 'UPSTREAM_ERROR', details, expose: true });
  }

  static internal(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 500, code: 'INTERNAL_ERROR', details });
  }
}
