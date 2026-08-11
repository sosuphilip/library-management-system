import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import { forbidden, unauthorized } from '../utils/httpError';
import type { Role, User } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: Omit<User, 'passwordHash'> & { passwordHash?: string };
  }
}

export interface JwtPayload {
  sub: string;
  role: Role;
  type: 'access' | 'refresh';
}

/** Parse the Bearer token from Authorization header. */
function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/** Verify a JWT of the given type and resolve the user. */
async function authenticate(req: Request, type: 'access' | 'refresh'): Promise<boolean> {
  const token = extractBearer(req);
  if (!token) return false;

  const secret = type === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, secret) as JwtPayload;
  } catch {
    return false;
  }
  if (payload.type !== type) return false;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') return false;
  req.user = user;
  return true;
}

/** Require a valid access token. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const ok = await authenticate(req, 'access');
  if (!ok) {
    next(unauthorized());
    return;
  }
  next();
}

/** Require a valid refresh token (for /auth/refresh). */
export async function requireRefresh(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const ok = await authenticate(req, 'refresh');
  if (!ok) {
    next(unauthorized());
    return;
  }
  next();
}

/** RBAC guard — call after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
