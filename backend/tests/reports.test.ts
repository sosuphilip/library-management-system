import { api, createTestUser, createLibrarian } from './helpers';
import prisma from '../src/lib/prisma';

describe('Reports & dashboard', () => {
  let librarian: { accessToken: string };
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    librarian = await createLibrarian();
    member = await createTestUser();
  });

  async function seedData() {
    // Two books, one copy each
    const b1 = await prisma.book.create({
      data: {
        title: 'Popular Book',
        copies: { create: [{ barcode: 'BC-R1' }] }
      },
      include: { copies: true }
    });
    const b2 = await prisma.book.create({
      data: {
        title: 'Less Popular',
        copies: { create: [{ barcode: 'BC-R2' }] }
      },
      include: { copies: true }
    });

    // 3 loans on b1 (2 active, 1 overdue), 1 loan on b2 (returned)
    const active1 = await prisma.loan.create({
      data: {
        userId: member.id,
        copyId: b1.copies[0].id,
        bookId: b1.id,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        fineRate: 0.5
      }
    });
    await prisma.loan.create({
      data: {
        userId: member.id,
        copyId: b2.copies[0].id,
        bookId: b2.id,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        fineRate: 0.5
      }
    });
    // Overdue active loan
    await prisma.loan.create({
      data: {
        userId: member.id,
        copyId: b1.copies[0].id,
        bookId: b1.id,
        dueDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        fineRate: 0.5
      }
    });
    // Fine against the active loan
    await prisma.fine.create({
      data: { userId: member.id, loanId: active1.id, amount: 5, balance: 5, reason: 'Late' }
    });

    return { b1, b2 };
  }

  describe('Dashboard', () => {
    it('returns summary stats', async () => {
      await seedData();
      const res = await api
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);

      const s = res.body.stats;
      expect(s.books).toBe(2);
      expect(s.copies).toBe(2);
      // activeLoans = all items currently out; overdue is a subset of it
      expect(s.activeLoans).toBe(3);
      expect(s.overdueLoans).toBe(1);
      expect(s.members).toBeGreaterThanOrEqual(1);
      expect(s.outstandingFines).toBe(5);
    });

    it('is staff-only', async () => {
      await api.get('/api/v1/reports/dashboard').set('Authorization', `Bearer ${member.accessToken}`).expect(403);
    });
  });

  describe('Most borrowed', () => {
    it('ranks books by loan count', async () => {
      await seedData();
      const res = await api
        .get('/api/v1/reports/most-borrowed')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.body.books[0].title).toBe('Popular Book');
      expect(res.body.books[0]._count.loans).toBe(2);
    });
  });

  describe('Overdue list', () => {
    it('lists only overdue active loans', async () => {
      await seedData();
      const res = await api
        .get('/api/v1/reports/overdue')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.body.loans).toHaveLength(1);
    });
  });

  describe('CSV export', () => {
    it('exports books as CSV with headers', async () => {
      await seedData();
      const res = await api
        .get('/api/v1/reports/export/books')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const body = res.text;
      expect(body.split('\n')[0]).toContain('title');
      expect(body).toContain('Popular Book');
    });

    it('exports fines as CSV', async () => {
      await seedData();
      const res = await api
        .get('/api/v1/reports/export/fines')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);
      expect(res.text).toContain('Late');
    });

    it('rejects unknown report kinds', async () => {
      await api
        .get('/api/v1/reports/export/not-a-report')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(400);
    });
  });
});
