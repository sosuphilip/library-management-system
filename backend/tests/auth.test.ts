import { api, createTestUser, createAdmin, registerMember } from './helpers';
import prisma from '../src/lib/prisma';

describe('Auth', () => {
  describe('POST /api/v1/auth/register', () => {
    it('registers a member and returns tokens', async () => {
      const res = await registerMember({
        email: 'reader@example.com',
        password: 'Passw0rd!',
        firstName: 'Ada',
        lastName: 'Lovelace'
      }).expect(201);

      expect(res.body.user).toMatchObject({
        email: 'reader@example.com',
        role: 'MEMBER',
        firstName: 'Ada',
        lastName: 'Lovelace'
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.membershipNumber).toMatch(/^L-\d{4}-\d{5}$/);
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();

      const stored = await prisma.user.findUnique({ where: { email: 'reader@example.com' } });
      expect(stored).not.toBeNull();
      // Password must be hashed, never stored in plaintext
      expect(stored!.passwordHash).not.toBe('Passw0rd!');
      expect(stored!.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt cost 12
    });

    it('rejects duplicate email', async () => {
      await createTestUser({ email: 'dup@example.com' });
      await registerMember({
        email: 'dup@example.com',
        password: 'Passw0rd!',
        firstName: 'A',
        lastName: 'B'
      }).expect(409);
    });

    it('rejects weak passwords', async () => {
      const res = await registerMember({
        email: 'weak@example.com',
        password: 'short',
        firstName: 'A',
        lastName: 'B'
      }).expect(400);
      expect(res.body.error.details).toBeDefined();
    });

    it('rejects invalid email', async () => {
      await registerMember({
        email: 'not-an-email',
        password: 'Passw0rd!',
        firstName: 'A',
        lastName: 'B'
      }).expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const user = await createTestUser({ email: 'login@example.com', password: 'Passw0rd!' });
      const res = await api
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'Passw0rd!' })
        .expect(200);

      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user.role).toBe(user.role);
      expect(res.body.tokens.accessToken).toBeDefined();
    });

    it('rejects wrong password', async () => {
      await createTestUser({ email: 'wrong@example.com', password: 'Passw0rd!' });
      await api
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@example.com', password: 'WrongPass1' })
        .expect(401);
    });

    it('rejects unknown email (same message as wrong password)', async () => {
      const res = await api
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Passw0rd!' })
        .expect(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('blocks suspended users', async () => {
      await createTestUser({
        email: 'suspended@example.com',
        status: 'SUSPENDED',
        password: 'Passw0rd!'
      });
      const res = await api
        .post('/api/v1/auth/login')
        .send({ email: 'suspended@example.com', password: 'Passw0rd!' })
        .expect(403);
      expect(res.body.error.message).toContain('suspended');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the current user with a valid token', async () => {
      const user = await createTestUser();
      const res = await api
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(res.body.user.id).toBe(user.id);
    });

    it('returns 401 without a token', async () => {
      await api.get('/api/v1/auth/me').expect(401);
    });

    it('returns 401 with a garbage token', async () => {
      await api.get('/api/v1/auth/me').set('Authorization', 'Bearer nope').expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('issues a new access token', async () => {
      const user = await createTestUser();
      const res = await api
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
      expect(res.body.tokens.refreshToken).not.toBe(user.refreshToken); // rotation
    });

    it('rejects an already-used refresh token (rotation)', async () => {
      const user = await createTestUser();
      // First use succeeds…
      await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(200);
      // …second use of the same token must fail
      await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    });

    it('rejects invalid refresh tokens', async () => {
      await api.post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-token' }).expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes the refresh token', async () => {
      const user = await createTestUser();
      await api.post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken }).expect(204);
      // Token now invalid for refresh
      await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    });
  });

  describe('Password reset', () => {
    it('creates a reset record on request (no account enumeration)', async () => {
      const user = await createTestUser({ email: 'reset@example.com', password: 'Passw0rd!' });

      await api
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'reset@example.com' })
        .expect(200);

      const tokenRow = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(tokenRow).not.toBeNull();
      expect(tokenRow!.usedAt).toBeNull();

      // Unknown email still returns 200 — never reveal whether an account exists
      await api
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'ghost@example.com' })
        .expect(200);
    });

    it('completes a reset, switches password, and kills old sessions', async () => {
      const user = await createTestUser({ email: 'reset2@example.com', password: 'Passw0rd!' });

      // Insert a reset record whose raw token we control
      const { generateToken, hashToken } = await import('../src/utils/crypto');
      const rawToken = generateToken();
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: hashToken(rawToken),
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000)
        }
      });

      await api
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: rawToken, password: 'NewPassw0rd!' })
        .expect(200);

      // Old password no longer works, new one does
      await api
        .post('/api/v1/auth/login')
        .send({ email: 'reset2@example.com', password: 'Passw0rd!' })
        .expect(401);
      await api
        .post('/api/v1/auth/login')
        .send({ email: 'reset2@example.com', password: 'NewPassw0rd!' })
        .expect(200);

      // Old refresh token is dead
      await api.post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);

      // Token cannot be reused
      await api
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: rawToken, password: 'Passw0rd!' })
        .expect(401);
    });

    it('rejects expired reset tokens', async () => {
      const user = await createTestUser({ email: 'reset3@example.com' });
      const { generateToken, hashToken } = await import('../src/utils/crypto');
      const rawToken = generateToken();
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: hashToken(rawToken),
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000) // already expired
        }
      });
      await api
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: rawToken, password: 'NewPassw0rd!' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('changes the password when current is correct', async () => {
      const user = await createTestUser({ password: 'Passw0rd!' });
      await api
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: 'Passw0rd!', newPassword: 'BrandNew1!' })
        .expect(200);

      await api
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'BrandNew1!' })
        .expect(200);
    });

    it('rejects wrong current password', async () => {
      const user = await createTestUser();
      await api
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: 'Wrong!', newPassword: 'BrandNew1!' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/staff (Admin-only)', () => {
    it('creates a librarian when called by an admin', async () => {
      const admin = await createAdmin();
      const res = await api
        .post('/api/v1/auth/staff')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          email: 'librarian@example.com',
          password: 'Passw0rd!',
          firstName: 'Grace',
          lastName: 'Hopper',
          role: 'LIBRARIAN'
        })
        .expect(201);
      expect(res.body.user.role).toBe('LIBRARIAN');
      expect(res.body.user.membershipNumber).toBeNull();
    });

    it('forbids members from creating staff', async () => {
      const member = await createTestUser();
      await api
        .post('/api/v1/auth/staff')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({
          email: 'nope@example.com',
          password: 'Passw0rd!',
          firstName: 'X',
          lastName: 'Y',
          role: 'LIBRARIAN'
        })
        .expect(403);
    });

    it('forbids unauthenticated creation', async () => {
      await api
        .post('/api/v1/auth/staff')
        .send({
          email: 'anon@example.com',
          password: 'Passw0rd!',
          firstName: 'X',
          lastName: 'Y',
          role: 'LIBRARIAN'
        })
        .expect(401);
    });
  });
});
