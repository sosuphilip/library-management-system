import { api, createTestUser } from './helpers';
import prisma from '../src/lib/prisma';
import { runSweep } from '../src/jobs/notification-cron';

describe('Notifications & daily sweep', () => {
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    member = await createTestUser();
  });

  async function seedLoan(dueInDays: number) {
    const book = await prisma.book.create({
      data: { title: `Notif ${dueInDays}`, copies: { create: [{ barcode: `BC-N-${dueInDays}` }] } },
      include: { copies: true }
    });
    return prisma.loan.create({
      data: {
        userId: member.id,
        copyId: book.copies[0].id,
        bookId: book.id,
        dueDate: new Date(Date.now() + dueInDays * 24 * 3600 * 1000),
        fineRate: 0.5
      }
    });
  }

  it('sends a due-soon notification for loans due within 3 days', async () => {
    await seedLoan(2); // due soon
    await seedLoan(30); // not due soon

    const result = await runSweep();

    expect(result.dueSoon).toBe(1);
    const notif = await prisma.notification.findFirst({ where: { type: 'DUE_SOON' } });
    expect(notif).not.toBeNull();
    expect(notif!.recipient).toBe(member.email);
    expect(notif!.status).toBe('SENT');
    expect(notif!.subject).toContain('due soon');
  });

  it('sends an overdue notification for past-due loans', async () => {
    await seedLoan(-4); // overdue

    const result = await runSweep();
    expect(result.overdue).toBe(1);
    const notif = await prisma.notification.findFirst({ where: { type: 'OVERDUE' } });
    expect(notif).not.toBeNull();
    expect(notif!.subject).toContain('Overdue');
  });

  it('does not re-notify the same loan on consecutive sweeps', async () => {
    await seedLoan(-4);
    await runSweep();
    const second = await runSweep();
    expect(second.overdue).toBe(0);
    expect(second.dueSoon).toBe(0);
  });

  it('expires stale READY holds', async () => {
    const book = await prisma.book.create({
      data: { title: 'Stale', copies: { create: [{ barcode: 'BC-STALE' }] } },
      include: { copies: true }
    });
    const stale = await prisma.reservation.create({
      data: {
        bookId: book.id,
        userId: member.id,
        copyId: book.copies[0].id,
        status: 'READY',
        readyAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        expiresAt: new Date(Date.now() - 1 * 24 * 3600 * 1000)
      }
    });

    const result = await runSweep();
    expect(result.holdsExpired).toBe(1);
    const updated = await prisma.reservation.findUnique({ where: { id: stale.id } });
    expect(updated!.status).toBe('EXPIRED');
  });

  it('lists a member’s notifications', async () => {
    await seedLoan(-1);
    await runSweep();

    const res = await api
      .get('/api/v1/notifications/me')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);

    expect(res.body.notifications.length).toBeGreaterThan(0);
    expect(res.body.notifications[0].status).toBe('SENT');
    expect(res.body.notifications[0]).toHaveProperty('readAt');
    expect(res.body.notifications[0].readAt).toBeNull();
  });

  it('marks a single notification as read', async () => {
    await seedLoan(-1);
    await runSweep();
    const notif = await prisma.notification.findFirstOrThrow({ where: { userId: member.id } });

    await api
      .post(`/api/v1/notifications/me/${notif.id}/read`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(204);

    const updated = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    expect(updated.readAt).not.toBeNull();
  });

  it('cannot mark another user’s notification as read', async () => {
    await seedLoan(-1);
    await runSweep();
    const other = await createTestUser();
    const notif = await prisma.notification.findFirstOrThrow({ where: { userId: member.id } });

    await api
      .post(`/api/v1/notifications/me/${notif.id}/read`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404);
  });

  it('marks all of a member’s notifications as read', async () => {
    await seedLoan(-1); // overdue → OVERDUE notification
    await seedLoan(2); // due soon → DUE_SOON notification
    await runSweep();
    expect(await prisma.notification.count({ where: { userId: member.id, readAt: null } })).toBe(2);

    const res = await api
      .post('/api/v1/notifications/me/read-all')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    expect(res.body.updated).toBe(2);

    expect(await prisma.notification.count({ where: { userId: member.id, readAt: null } })).toBe(0);
  });
});
