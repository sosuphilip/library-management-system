import { NextFunction, Request, Response } from 'express';
import { HttpError } from './httpError';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route handler so thrown/rejected errors reach the error
 *  middleware instead of crashing Express 4. */
export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Re-throw a Prisma unique-constraint violation as a 409 conflict. */
export const mapPrismaConflict = (error: unknown): HttpError => {
  const e = error as { code?: string; meta?: { target?: string[] } };
  if (e?.code === 'P2002') {
    return new HttpError(409, `Duplicate value for ${(e.meta?.target ?? ['field']).join(', ')}`, {
      code: 'CONFLICT'
    });
  }
  if (e instanceof HttpError) return e;
  if (error instanceof Error) {
    return new HttpError(500, error.message, { code: 'INTERNAL' });
  }
  return new HttpError(500, 'Internal server error', { code: 'INTERNAL' });
};
