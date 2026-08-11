import { api, createTestUser, createLibrarian } from './helpers';
import prisma from '../src/lib/prisma';
import type { Copy } from '@prisma/client';

/** Create a book with one available copy, returns { book, copy } */
async function seedBookWithCopy(librarian: { accessToken: string }, barcode = 'BC-C1') {
  const res = await api
    .post('/api/v1/catalog')
    .set('Authorization', `Bearer ${librarian.accessToken}`)
    .send({ title: `Book ${barcode}`, copies: [{ barcode, condition: 'GOOD' }] })
    .expect(201);
  return { book: res.body.book, copy: res.body.book.copies[0] as Copy };
}

describe('Circulation', () => {
  let librarian: { accessToken: string };
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    librarian = await createLibrarian();
    member = await createTestUser();
  });

  describe('Checkout & return', () => {
    it('checks out an available copy', async () => {
      const { copy } = await seedBookWithCopy(librarian);

      const res = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);

      expect(res.body.loan.status).toBe('ACTIVE');
      expect(res.body.loan.userId).toBe(member.id);
      // due date ~14 days out
      const days = (new Date(res.body.loan.dueDate).getTime() - Date.now()) / (24 * 3600 * 1000);
      expect(days).toBeGreaterThan(13);
      expect(days).toBeLessThan(15);

      const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
      expect(updatedCopy!.status).toBe('CHECKED_OUT');
    });

    it('blocks checking out an already-checked-out copy', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);

      const other = await createTestUser();
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: other.id })
        .expect(409);
    });

    it('blocks checkout for a suspended member', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      const suspended = await createTestUser({ status: 'SUSPENDED' });
      const res = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: suspended.id })
        .expect(403);
      expect(res.body.error.message).toContain('suspended');
    });

    it('forbids members from checking out items', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(403);
    });

    it('returns a copy and frees it', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);

      const res = await api
        .post('/api/v1/circulation/returns')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id })
        .expect(200);

      expect(res.body.loan.status).toBe('RETURNED');
      const updatedCopy = await prisma.copy.findUnique({ where: { id: copy.id } });
      expect(updatedCopy!.status).toBe('AVAILABLE');
    });

    it('charges a fine for a late return', async () => {
      const { copy } = await seedBookWithCopy(librarian);

      const loanRes = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);
      const loanId = loanRes.body.loan.id;

      // Age the loan: mark it overdue by 5 days
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000);
      await prisma.loan.update({
        where: { id: loanId },
        data: { checkedOutAt: new Date(Date.now() - 19 * 24 * 3600 * 1000), dueDate: fiveDaysAgo }
      });

      const res = await api
        .post('/api/v1/circulation/returns')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id })
        .expect(200);

      expect(res.body.fine).toBeDefined();
      // fine rate 0.50/day × 5 days
      expect(Number(res.body.fine.amount)).toBeCloseTo(2.5);
      expect(res.body.fine.status).toBe('UNPAID');
    });

    it('creates no fine for an on-time return', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);

      const res = await api
        .post('/api/v1/circulation/returns')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id })
        .expect(200);
      expect(res.body.fine).toBeUndefined();
    });
  });

  describe('Renewal', () => {
    it('renews an active loan and extends the due date', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      const loanRes = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);
      const { id, dueDate } = loanRes.body.loan;

      const res = await api
        .post(`/api/v1/circulation/loans/${id}/renew`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(200);

      expect(res.body.loan.renewals).toBe(1);
      expect(new Date(res.body.loan.dueDate).getTime()).toBeGreaterThan(new Date(dueDate).getTime());
    });

    it('respects the renewal limit', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      const loanRes = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);
      const { id } = loanRes.body.loan;

      // Set renewals to the max (2)
      await prisma.loan.update({ where: { id }, data: { renewals: 2 } });

      await api
        .post(`/api/v1/circulation/loans/${id}/renew`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(409);
    });

    it('refuses to renew an overdue loan', async () => {
      const { copy } = await seedBookWithCopy(librarian);
      const loanRes = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);
      const { id } = loanRes.body.loan;

      await prisma.loan.update({ where: { id }, data: { dueDate: new Date(Date.now() - 1000) } });

      await api
        .post(`/api/v1/circulation/loans/${id}/renew`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(409);
    });
  });

  describe('Reservations / holds', () => {
    it('places a hold on a book with no available copies (WAITING)', async () => {
      const { book } = await seedBookWithCopy(librarian);
      // Check out the only copy
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: book.copies[0].id, userId: member.id })
        .expect(201);

      const res = await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);

      expect(res.body.reservation.status).toBe('WAITING');
      expect(res.body.reservation.position).toBe(1);
    });

    it('immediately readies a hold when a copy is available', async () => {
      const { book } = await seedBookWithCopy(librarian);
      const res = await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);
      expect(res.body.reservation.status).toBe('READY');
      expect(res.body.reservation.copyId).toBe(book.copies[0].id);
    });

    it('fulfils a READY hold when the holder checks out that copy', async () => {
      const { book } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);

      const checkout = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: book.copies[0].id, userId: member.id })
        .expect(201);
      expect(checkout.body.loan.status).toBe('ACTIVE');

      const hold = await prisma.reservation.findFirst({ where: { userId: member.id } });
      expect(hold!.status).toBe('FULFILLED');
    });

    it('blocks another member from taking a held copy', async () => {
      const { book } = await seedBookWithCopy(librarian);
      await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);

      const other = await createTestUser();
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: book.copies[0].id, userId: other.id })
        .expect(409);
    });

    it('moves the queue when a copy is returned', async () => {
      const { book, copy } = await seedBookWithCopy(librarian);
      // Member A checks out the only copy
      await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);

      // Members B and C place holds
      const b = await createTestUser();
      const c = await createTestUser();
      await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);
      await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${c.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);

      // A returns → B's hold becomes READY
      await api
        .post('/api/v1/circulation/returns')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id })
        .expect(200);

      const bHold = await prisma.reservation.findFirst({
        where: { userId: b.id },
        orderBy: { createdAt: 'asc' }
      });
      expect(bHold!.status).toBe('READY');
      const cHold = await prisma.reservation.findFirst({
        where: { userId: c.id },
        orderBy: { createdAt: 'asc' }
      });
      expect(cHold!.status).toBe('WAITING');
    });

    it('cancels a hold', async () => {
      const { book } = await seedBookWithCopy(librarian);
      const res = await api
        .post('/api/v1/circulation/reserve')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ bookId: book.id })
        .expect(201);

      await api
        .delete(`/api/v1/circulation/reservations/${res.body.reservation.id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(204);

      const hold = await prisma.reservation.findUnique({ where: { id: res.body.reservation.id } });
      expect(hold!.status).toBe('CANCELLED');
    });
  });

  describe('Fines', () => {
    async function createOverdueFine(): Promise<{ fineId: string; userId: string; amount: number }> {
      const { copy } = await seedBookWithCopy(librarian);
      const loanRes = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id, userId: member.id })
        .expect(201);
      const loanId = loanRes.body.loan.id;
      await prisma.loan.update({
        where: { id: loanId },
        data: { dueDate: new Date(Date.now() - 4 * 24 * 3600 * 1000) }
      });
      const ret = await api
        .post('/api/v1/circulation/returns')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: copy.id })
        .expect(200);
      return { fineId: ret.body.fine.id, userId: member.id, amount: Number(ret.body.fine.amount) };
    }

    it('pays a fine in full', async () => {
      const { fineId, amount } = await createOverdueFine();

      const res = await api
        .post('/api/v1/circulation/fines/pay')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ fineId, amount, method: 'CARD' })
        .expect(200);

      expect(res.body.fine.status).toBe('PAID');
      expect(Number(res.body.fine.balance)).toBe(0);
    });

    it('supports partial payments', async () => {
      const { fineId, amount } = await createOverdueFine();

      const res = await api
        .post('/api/v1/circulation/fines/pay')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ fineId, amount: amount / 2, method: 'CASH' })
        .expect(200);

      expect(res.body.fine.status).toBe('UNPAID');
      expect(Number(res.body.fine.balance)).toBeCloseTo(amount / 2);
    });

    it('rejects overpayment', async () => {
      const { fineId, amount } = await createOverdueFine();
      await api
        .post('/api/v1/circulation/fines/pay')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ fineId, amount: amount * 10, method: 'CASH' })
        .expect(400);
    });

    it('waives a fine with a reason (staff only)', async () => {
      const { fineId } = await createOverdueFine();
      const res = await api
        .post('/api/v1/circulation/fines/waive')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ fineId, reason: 'First-time courtesy' })
        .expect(200);
      expect(res.body.fine.status).toBe('WAIVED');
    });

    it('forbids members from waiving fines', async () => {
      const { fineId } = await createOverdueFine();
      await api
        .post('/api/v1/circulation/fines/waive')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ fineId, reason: 'self waiver' })
        .expect(403);
    });
  });

  describe('Suspension policy', () => {
    it('auto-suspends a member who crosses the overdue threshold', async () => {
      // Create two overdue loans for the same member
      const s1 = await seedBookWithCopy(librarian, 'BC-S1');
      const s2 = await seedBookWithCopy(librarian, 'BC-S2');

      const a1 = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: s1.copy.id, userId: member.id })
        .expect(201);
      const a2 = await api
        .post('/api/v1/circulation/checkout')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ copyId: s2.copy.id, userId: member.id })
        .expect(201);

      // Age both loans overdue
      const past = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      await prisma.loan.update({ where: { id: a1.body.loan.id }, data: { dueDate: past } });
      await prisma.loan.update({ where: { id: a2.body.loan.id }, data: { dueDate: past } });

      // Trigger the policy via a payment evaluation on this member
      const { evaluateSuspension } = await import('../src/services/circulation.service');
      const result = await evaluateSuspension(member.id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('SUSPENDED');
      expect(result!.suspendedUntil).not.toBeNull();
    });
  });
});
