import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/httpError';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/** Consistent JSON error shape for every endpoint. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Explicit HttpErrors (from validation, authorization, business rules)
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code ?? 'BAD_REQUEST',
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {})
      }
    });
    return;
  }

  // Prisma known request errors → map to 4xx where sensible
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A record with that value already exists.' }
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
      return;
    }
  }

  // Zod errors that escaped the validate middleware
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: Array<{ path: unknown; message: string }> }).issues;
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: issues.map((i) => ({ path: String(i.path), message: i.message }))
      }
    });
    return;
  }

  // Unknown errors: log and return a generic 500 (never leak internals)
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ err }, 'Unhandled error');
  if (env.NODE_ENV === 'production') {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  } else {
    res.status(500).json({ error: { code: 'INTERNAL', message } });
  }
}
