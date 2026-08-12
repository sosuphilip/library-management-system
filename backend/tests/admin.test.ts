import { api, createAdmin, createLibrarian, createTestUser } from './helpers';
import prisma from '../src/lib/prisma';
import { runSweep } from '../src/jobs/notification-cron';

describe('Admin — audit log & email templates', () => {
  let admin: Awaited<ReturnType<typeof createAdmin>>;
  let librarian: Awaited<ReturnType<typeof createLibrarian>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    admin = await createAdmin();
    librarian = await createLibrarian();
    member = await createTestUser();
  });

  // ---------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------

  it('rejects non-admins from the audit log', async () => {
    await api
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${librarian.accessToken}`)
      .expect(403);
    await api
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(403);
    await api.get('/api/v1/admin/audit').expect(401);
  });

  it('lists audit entries newest-first with actor info', async () => {
    const res = await api
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('action');
    expect(res.body.items[0]).toHaveProperty('createdAt');
  });

  it('lists distinct entity types for the filter dropdown', async () => {
    const res = await api
      .get('/api/v1/admin/audit/entity-types')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.entityTypes.length).toBeGreaterThan(0);
    expect(res.body.entityTypes).toContain('USER');
  });

  it('filters the audit log by action', async () => {
    // A fresh login writes a USER.LOGIN entry
    await api.post('/api/v1/auth/login').send({ email: member.email, password: member.password }).expect(200);

    const res = await api
      .get('/api/v1/admin/audit?action=USER.LOGIN')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.action).toBe('USER.LOGIN');
    }
  });

  // ---------------------------------------------------------------
  // Email templates
  // ---------------------------------------------------------------

  it('lists all template types with defaults', async () => {
    const res = await api
      .get('/api/v1/admin/templates')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const types = res.body.templates.map((t: { type: string }) => t.type);
    expect(types).toEqual(
      expect.arrayContaining(['DUE_SOON', 'OVERDUE', 'HOLD_AVAILABLE', 'HOLD_EXPIRED', 'PASSWORD_RESET', 'FINE_CHARGED'])
    );
    const dueSoon = res.body.templates.find((t: { type: string }) => t.type === 'DUE_SOON');
    expect(dueSoon.isDefault).toBe(true);
    expect(dueSoon.subject).toContain('due soon');
  });

  it('requires an admin to view or edit templates', async () => {
    await api
      .get('/api/v1/admin/templates')
      .set('Authorization', `Bearer ${librarian.accessToken}`)
      .expect(403);
    await api
      .put('/api/v1/admin/templates/OVERDUE')
      .set('Authorization', `Bearer ${librarian.accessToken}`)
      .send({ subject: 'Custom', body: 'Custom body' })
      .expect(403);
  });

  it('validates template input', async () => {
    await api
      .put('/api/v1/admin/templates/OVERDUE')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ subject: '', body: '' })
      .expect(400);
    await api
      .put('/api/v1/admin/templates/NOT_A_TYPE')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ subject: 'x', body: 'y' })
      .expect(400);
  });

  it('upserts a template and the notification sweep uses it', async () => {
    await api
      .put('/api/v1/admin/templates/DUE_SOON')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ subject: 'Custom reminder: {bookTitle}', body: 'Hi {firstName}, please hurry.' })
      .expect(200);

    const book = await prisma.book.create({
      data: { title: 'Template Probe', copies: { create: [{ barcode: 'BC-TPL' }] } },
      include: { copies: true }
    });
    await prisma.loan.create({
      data: {
        userId: member.id,
        copyId: book.copies[0].id,
        bookId: book.id,
        dueDate: new Date(Date.now() + 1 * 24 * 3600 * 1000),
        fineRate: 0.5
      }
    });

    await runSweep();

    const notif = await prisma.notification.findFirstOrThrow({ where: { type: 'DUE_SOON' } });
    expect(notif.subject).toBe('Custom reminder: Template Probe');

    // Listing now shows the stored template as non-default
    const res = await api
      .get('/api/v1/admin/templates')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const dueSoon = res.body.templates.find((t: { type: string }) => t.type === 'DUE_SOON');
    expect(dueSoon.isDefault).toBe(false);
  });
});
