import { api, createTestUser, createLibrarian } from './helpers';
import prisma from '../src/lib/prisma';

describe('Member management', () => {
  let librarian: { accessToken: string };
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    librarian = await createLibrarian();
    member = await createTestUser();
  });

  describe('Listing members', () => {
    it('lists members (staff only)', async () => {
      await createTestUser({ email: 'alice@test.local', firstName: 'Alice' });
      await createTestUser({ email: 'bob@test.local', firstName: 'Bob' });

      const res = await api
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);

      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.items[0]).toHaveProperty('membershipNumber');
      expect(res.body.items[0].passwordHash).toBeUndefined();
    });

    it('forbids members from listing members', async () => {
      await api.get('/api/v1/members').set('Authorization', `Bearer ${member.accessToken}`).expect(403);
    });

    it('searches members by name', async () => {
      await createTestUser({ email: 'findme@test.local', firstName: 'Zelda' });
      const res = await api
        .get('/api/v1/members?q=zelda')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Member dossier', () => {
    it('returns profile, loans, holds, fines and stats', async () => {
      // Give the member a couple of loans via direct DB + a fine
      const book = await prisma.book.create({
        data: {
          title: 'Dossier Book',
          copies: {
            create: [
              { barcode: 'BC-DOS-1', status: 'CHECKED_OUT' },
              { barcode: 'BC-DOS-2', status: 'AVAILABLE' }
            ]
          }
        },
        include: { copies: true }
      });

      await prisma.loan.create({
        data: {
          userId: member.id,
          copyId: book.copies[0].id,
          bookId: book.id,
          status: 'ACTIVE',
          dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
          fineRate: 0.5
        }
      });
      await prisma.fine.create({
        data: {
          userId: member.id,
          amount: 4,
          balance: 4,
          reason: 'Test fine'
        }
      });

      const res = await api
        .get(`/api/v1/members/${member.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);

      expect(res.body.stats.activeLoans).toBe(1);
      expect(res.body.stats.unpaidFines).toBe(4);
      expect(res.body.activeLoans).toHaveLength(1);
      expect(res.body.fines).toHaveLength(1);
      expect(res.body.member.id).toBe(member.id);
    });

    it('returns 404 for unknown members', async () => {
      await api
        .get('/api/v1/members/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(404);
    });
  });

  describe('Suspend / reinstate', () => {
    it('suspends a member for a number of days', async () => {
      const res = await api
        .post(`/api/v1/members/${member.id}/suspend`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ days: 7 })
        .expect(200);

      expect(res.body.member.status).toBe('SUSPENDED');
      expect(res.body.member.suspendedUntil).not.toBeNull();
    });

    it('reinstate clears the suspension', async () => {
      await prisma.user.update({
        where: { id: member.id },
        data: { status: 'SUSPENDED', suspendedUntil: new Date() }
      });
      const res = await api
        .post(`/api/v1/members/${member.id}/reinstate`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.body.member.status).toBe('ACTIVE');
      expect(res.body.member.suspendedUntil).toBeNull();
    });
  });

  describe('Staff fine adjustment', () => {
    it('waives a fine (no amount = full waive)', async () => {
      const fine = await prisma.fine.create({
        data: { userId: member.id, amount: 3, balance: 3, reason: 'Late' }
      });
      const res = await api
        .post(`/api/v1/members/fines/${fine.id}/adjust`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ reason: 'Staff courtesy' })
        .expect(200);
      expect(res.body.fine.status).toBe('WAIVED');
      expect(res.body.fine.balance).toBe(0);
    });

    it('records a partial adjustment', async () => {
      const fine = await prisma.fine.create({
        data: { userId: member.id, amount: 10, balance: 10, reason: 'Late' }
      });
      const res = await api
        .post(`/api/v1/members/fines/${fine.id}/adjust`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ amount: 4, reason: 'Partial waiver' })
        .expect(200);
      expect(res.body.fine.balance).toBe(6);
      expect(res.body.fine.status).toBe('UNPAID');
    });
  });
});
