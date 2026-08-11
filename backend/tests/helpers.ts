import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import type { Role } from '@prisma/client';

export const api = request(app);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  accessToken: string;
  refreshToken: string;
}

/** Create a user directly in the DB and return credentials + fresh tokens. */
export async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  membershipNumber?: string;
}> = {}): Promise<TestUser> {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const password = overrides.password ?? 'Passw0rd!';
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 4), // cheap hash for tests
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      role: overrides.role ?? 'MEMBER',
      status: overrides.status ?? 'ACTIVE',
      membershipNumber: overrides.membershipNumber ?? `L-${Math.floor(Math.random() * 1e6)}`
    }
  });

  // Suspended users are blocked from logging in (403), so tokens are unavailable.
  const isSuspended = user.status === 'SUSPENDED';
  const login = isSuspended
    ? null
    : await api.post('/api/v1/auth/login').send({ email, password }).expect(200);
  return {
    id: user.id,
    email,
    password,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    accessToken: login?.body.tokens.accessToken ?? '',
    refreshToken: login?.body.tokens.refreshToken ?? ''
  };
}

export async function createAdmin(overrides: Partial<{ email: string }> = {}) {
  return createTestUser({ role: 'ADMIN', email: overrides.email });
}

export async function createLibrarian(overrides: Partial<{ email: string }> = {}) {
  return createTestUser({ role: 'LIBRARIAN', email: overrides.email });
}

/** Register a brand-new member via the public API (tests the real flow). */
export function registerMember(body: Record<string, unknown>) {
  // Deliberately NOT async: callers chain .expect(201) etc. on the supertest Test.
  return api.post('/api/v1/auth/register').send(body);
}
