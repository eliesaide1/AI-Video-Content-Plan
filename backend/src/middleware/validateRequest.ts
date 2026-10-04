import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../infrastructure/errors/AppError.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Input validation at the edge (Security: "Validate API inputs").
 * Parsed values replace the raw ones, so controllers receive typed, trimmed data.
 */
export function validateRequest(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          AppError.validation(
            'Some of the values you sent are not valid.',
            error.issues.map((issue) => ({
              field: issue.path.join('.') || '(root)',
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(error);
    }
  };
}
