import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so a rejected promise reaches the global error
 * middleware instead of hanging the request. Every controller is wrapped in
 * this, which is why no controller needs its own try/catch.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
