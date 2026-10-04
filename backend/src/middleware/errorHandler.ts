import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { isProduction } from '../infrastructure/config.js';

const log = createLogger('error');

/** The single error shape every endpoint returns. The frontend's shared
 *  service reads exactly this and shows it in one alert component. */
export interface ApiErrorBody {
  success: false;
  error: {
    message: string;
    code: string;
    status: number;
    details?: unknown;
    requestId?: string;
    stack?: string;
  };
}

/** 404 for unknown routes — funnelled through the same error pipeline. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * GLOBAL ERROR HANDLER.
 *
 * Every failure in the API ends up here: thrown AppErrors, Zod validation
 * failures, Mongoose errors, and anything unexpected. Nothing else in the
 * codebase formats an error response, so the frontend only ever has to
 * understand one payload shape.
 *
 * Internal details (stack traces, driver messages) are never leaked in
 * production — the client gets a safe message plus the requestId.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalised = normalise(error);

  if (normalised.statusCode >= 500) {
    log.error(`${req.method} ${req.originalUrl} [${req.requestId}] ${normalised.message}`, error);
  } else {
    log.warn(`${req.method} ${req.originalUrl} [${req.requestId}] ${normalised.message}`);
  }

  const body: ApiErrorBody = {
    success: false,
    error: {
      message:
        normalised.expose || !isProduction
          ? normalised.message
          : 'Something went wrong on the server. Please try again.',
      code: normalised.code,
      status: normalised.statusCode,
      ...(normalised.details === undefined ? {} : { details: normalised.details }),
      requestId: req.requestId,
      ...(isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
    },
  };

  res.status(normalised.statusCode).json(body);
}

function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return AppError.validation(
      'Some of the values you sent are not valid.',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return AppError.validation(
      'The data could not be saved because it is invalid.',
      Object.values(error.errors).map((fieldError) => ({
        field: fieldError.path,
        message: fieldError.message,
      })),
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`"${String(error.value)}" is not a valid ${error.path}.`);
  }

  // Duplicate key — raised by our unique indexes (dedupeKey, topicId, ...).
  if (isMongoDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {}).join(', ') || 'value';
    return AppError.conflict(`That ${field} already exists.`);
  }

  if (error instanceof Error) {
    if (error.name === 'MongooseServerSelectionError') {
      return new AppError('The database is unreachable. Is MongoDB running?', {
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
        expose: true,
      });
    }
    return AppError.internal(error.message);
  }

  return AppError.internal('Unknown error');
}

function isMongoDuplicateKeyError(
  error: unknown,
): error is { code: number; keyPattern?: Record<string, unknown> } {
  return Boolean(error) && (error as { code?: number }).code === 11000;
}
