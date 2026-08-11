import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { generateToken, hashToken } from '../utils/crypto';
import { audit } from './audit.service';
import { conflict, forbidden, notFound, unauthorized } from '../utils/httpError';
import { mailer } from '../lib/mailer';

/** bcrypt cost factor — deliberately expensive (spec requirement). */
const BCRYPT_COST = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  status: User['status'];
  membershipNumber: string | null;
  suspendedUntil: Date | null;
}

/** Strip sensitive fields before returning a user to the client. */
export function toPublicUser(
  user: User | (Omit<User, 'passwordHash'> & { passwordHash?: string })
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    membershipNumber: user.membershipNumber,
    suspendedUntil: user.suspendedUntil
  };
}

function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

function signRefreshToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign({ sub: user.id, role: user.role, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

/** Sign a token pair and persist the refresh-token hash for rotation/revocation. */
async function issueTokens(user: User): Promise<AuthTokens> {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const expiresInMs = msFromString(env.JWT_REFRESH_EXPIRES_IN);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + expiresInMs)
    }
  });

  return { accessToken, refreshToken };
}

/** Parse durations like "15m", "7d", "90s" into milliseconds. */
function msFromString(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  switch (match[2]) {
    case 's':
      return value * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
}

function generateMembershipNumber(): string {
  // Format: L-<year>-<5 random digits>, e.g. L-2026-48213
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `L-${year}-${rand}`;
}

// ---------------------------------------------------------------
// Registration & login
// ---------------------------------------------------------------

export interface RegisterParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export async function register(params: RegisterParams): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: 'MEMBER',
      membershipNumber: generateMembershipNumber()
    }
  });

  await audit({
    action: 'USER.REGISTER',
    entityType: 'USER',
    entityId: user.id,
    actorId: user.id
  });

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), tokens };
}

export async function login(email: string, password: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw unauthorized('Invalid email or password');

  if (user.status !== 'ACTIVE') {
    throw forbidden(
      user.status === 'SUSPENDED'
        ? `Your account is suspended${user.suspendedUntil ? ` until ${user.suspendedUntil.toISOString().slice(0, 10)}` : ''}.`
        : 'Your account is not active.'
    );
  }

  await audit({
    action: 'USER.LOGIN',
    entityType: 'USER',
    entityId: user.id,
    actorId: user.id
  });

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), tokens };
}

// ---------------------------------------------------------------
// Token refresh & logout
// ---------------------------------------------------------------

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload: { sub: string; role: Role; type: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sub: string;
      role: Role;
      type: string;
    };
  } catch {
    throw unauthorized('Invalid refresh token');
  }
  if (payload.type !== 'refresh') throw unauthorized('Invalid refresh token');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true }
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Refresh token is no longer valid');
  }
  if (stored.user.status !== 'ACTIVE') {
    throw forbidden('Your account is not active.');
  }

  // Rotation: revoke the presented token, issue a fresh pair
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() }
  });

  return issueTokens(stored.user);
}

export async function logout(refreshToken: string, userId?: string): Promise<void> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });
  if (stored && (!userId || stored.userId === userId)) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });
  }
}

/** Revoke every refresh token a user owns (used on password change / reset). */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

// ---------------------------------------------------------------
// Password reset & change
// ---------------------------------------------------------------

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed publicly — don't reveal whether an account exists.
  if (!user) return;

  const rawToken = generateResetToken();
  const ttlMs = env.PASSWORD_RESET_TOKEN_TTL_MIN * 60 * 1000;

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlMs)
    }
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;
  await mailer.send({
    to: user.email,
    subject: 'Reset your Library password',
    text: `Hi ${user.firstName},\n\nSomeone requested a password reset for your account. Click the link below to set a new password (valid for ${env.PASSWORD_RESET_TOKEN_TTL_MIN} minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`
  });
}

function generateResetToken(): string {
  return generateToken();
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (
    !stored ||
    stored.usedAt ||
    stored.expiresAt < new Date()
  ) {
    throw unauthorized('That reset link is invalid or has expired. Request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() }
    })
  ]);

  // Invalidate all sessions after a password reset
  await revokeAllUserTokens(stored.userId);

  await audit({
    action: 'USER.PASSWORD_RESET',
    entityType: 'USER',
    entityId: stored.userId,
    actorId: stored.userId
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllUserTokens(userId);

  await audit({
    action: 'USER.PASSWORD_CHANGE',
    entityType: 'USER',
    entityId: userId,
    actorId: userId
  });
}

// ---------------------------------------------------------------
// Staff accounts (Admin)
// ---------------------------------------------------------------

export interface CreateStaffParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'LIBRARIAN';
}

export async function createStaff(params: CreateStaffParams): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_COST);
  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role
    }
  });

  await audit({
    action: 'STAFF.CREATE',
    entityType: 'USER',
    entityId: user.id,
    metadata: { role: params.role }
  });

  return toPublicUser(user);
}
