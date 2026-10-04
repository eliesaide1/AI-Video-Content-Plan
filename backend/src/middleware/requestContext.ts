import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { createLogger } from '../infrastructure/logger.js';

const log = createLogger('http');

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Attaches a request id (returned in every error payload so a user-visible
 * alert can be matched to a server log line) and logs the request outcome.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const line = `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`;
    if (res.statusCode >= 500) log.error(line);
    else if (res.statusCode >= 400) log.warn(line);
    else log.info(line);
  });

  next();
}
