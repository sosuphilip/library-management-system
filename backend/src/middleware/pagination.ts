import { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    pagination: { page: number; limit: number };
  }
}

/** Attach parsed+clamped pagination to every request. */
export function paginationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
  req.pagination = { page, limit };
  next();
}
