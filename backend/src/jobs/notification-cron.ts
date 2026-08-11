import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { policy } from '../config/policy';
import { sendNotification, resolveTemplate, renderTemplate } from '../services/notification.service';
import { expireStaleReadyHolds } from '../services/circulation.service';

const DUE_SOON_WINDOW_DAYS = 3;

/** Has this loan already received a notification of `type`? */
async function alreadyNotified(loanId: string, type: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({ where: { relatedLoanId: loanId, type: type as never } });
  return Boolean(existing);
}

export async function runSweep(now = new Date()): Promise<{ dueSoon: number; overdue: number; holdsExpired: number }> {
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ---- Due-soon loans ----
  const dueSoonLoans = await prisma.loan.findMany({
    where: {
      status: 'ACTIVE',
      dueDate: { gte: now, lte: dueSoonCutoff }
    },
    include: { copy: { include: { book: true } }, user: true }
  });

  let dueSoon = 0;
  for (const loan of dueSoonLoans) {
    if (await alreadyNotified(loan.id, 'DUE_SOON')) continue;
    const tpl = resolveTemplate('DUE_SOON');
    const { subject, body } = renderTemplate(tpl, {
      firstName: loan.user.firstName,
      bookTitle: loan.copy.book.title,
      dueDate: loan.dueDate.toISOString().slice(0, 10)
    });
    await sendNotification({
      userId: loan.userId,
      type: 'DUE_SOON',
      subject,
      body,
      relatedLoanId: loan.id
    });
    dueSoon++;
  }

  // ---- Overdue loans ----
  const overdueLoans = await prisma.loan.findMany({
    where: { status: 'ACTIVE', dueDate: { lt: now } },
    include: { copy: { include: { book: true } }, user: true }
  });

  let overdue = 0;
  for (const loan of overdueLoans) {
    if (await alreadyNotified(loan.id, 'OVERDUE')) continue;
    const tpl = resolveTemplate('OVERDUE');
    const { subject, body } = renderTemplate(tpl, {
      firstName: loan.user.firstName,
      bookTitle: loan.copy.book.title,
      dueDate: loan.dueDate.toISOString().slice(0, 10),
      fineRate: policy.fineRatePerDay
    });
    await sendNotification({
      userId: loan.userId,
      type: 'OVERDUE',
      subject,
      body,
      relatedLoanId: loan.id
    });
    overdue++;
  }

  // ---- Expire stale READY holds ----
  const holdsExpired = await expireStaleReadyHolds();

  return { dueSoon, overdue, holdsExpired };
}

/** Daily sweep — default 7:10am local (avoid the exact :00 mark). */
export function startNotificationCron(): void {
  const scheduled = cron.schedule('10 7 * * *', async () => {
    logger.info('Running daily notification sweep');
    try {
      const result = await runSweep();
      logger.info({ ...result }, 'Notification sweep complete');
    } catch (error) {
      logger.error({ error }, 'Notification sweep failed');
    }
  });
  scheduled.start();
  logger.info('Notification cron scheduled (daily 07:10)');
}
