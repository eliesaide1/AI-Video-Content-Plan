import type { Response } from 'express';

/** The single success envelope. Mirrors ApiErrorBody in the error middleware. */
export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccessBody<T> = { success: true, data };
  res.status(status).json(body);
}

export function accepted<T>(res: Response, data: T): void {
  ok(res, data, 202);
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}
