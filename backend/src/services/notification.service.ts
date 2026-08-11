import type { Notification, NotificationType } from '@prisma/client';
import prisma from '../lib/prisma';
import { mailer } from '../lib/mailer';

interface NotifyParams {
  userId: string;
  type: NotificationType;
  subject: string;
  body: string;
  relatedLoanId?: string;
  relatedReservationId?: string;
}

/**
 * Persist a Notification record, send the email, and record the outcome.
 * Sending failures are captured on the record — never thrown — so the daily
 * sweep can't crash the process.
 */
export async function sendNotification(params: NotifyParams): Promise<Notification> {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  const recipient = user?.email ?? null;

  const record = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      channel: 'EMAIL',
      subject: params.subject,
      body: params.body,
      recipient,
      relatedLoanId: params.relatedLoanId,
      relatedReservationId: params.relatedReservationId
    }
  });

  if (!recipient) {
    return prisma.notification.update({
      where: { id: record.id },
      data: { status: 'FAILED', error: 'User has no email' }
    });
  }

  try {
    await mailer.send({ to: recipient, subject: params.subject, text: params.body });
    return prisma.notification.update({
      where: { id: record.id },
      data: { status: 'SENT', sentAt: new Date() }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.notification.update({
      where: { id: record.id },
      data: { status: 'FAILED', error: message.slice(0, 500) }
    });
  }
}

/** Default templates used when no EmailTemplate row exists for the type. */
export function resolveTemplate(type: NotificationType): { subject: string; body: string } {
  switch (type) {
    case 'DUE_SOON':
      return {
        subject: 'Reminder: "{bookTitle}" is due soon',
        body:
          'Hi {firstName},\n\nJust a reminder that "{bookTitle}" is due back on {dueDate}. Please return or renew it to avoid late fines.\n\n— Your Library'
      };
    case 'OVERDUE':
      return {
        subject: 'Overdue: "{bookTitle}"',
        body:
          'Hi {firstName},\n\nYour loan of "{bookTitle}" is now overdue (due {dueDate}). Please return it as soon as possible. Late fines accrue daily at {fineRate}.\n\n— Your Library'
      };
    case 'HOLD_AVAILABLE':
      return {
        subject: 'Your hold is ready: "{bookTitle}"',
        body:
          'Hi {firstName},\n\n"{bookTitle}" is now available for pickup. The hold expires on {expiresAt}.\n\n— Your Library'
      };
    case 'HOLD_EXPIRED':
      return {
        subject: 'Your hold has expired: "{bookTitle}"',
        body:
          'Hi {firstName},\n\nYour hold on "{bookTitle}" expired before you picked it up. If you still want it, place a new hold.\n\n— Your Library'
      };
    case 'PASSWORD_RESET':
      return {
        subject: 'Reset your Library password',
        body: 'Hi {firstName},\n\nUse the link below to reset your password (valid for {ttl} minutes):\n\n{link}\n\n— Your Library'
      };
    case 'FINE_CHARGED':
      return {
        subject: 'A fine has been added to your account',
        body:
          'Hi {firstName},\n\nA fine of {amount} has been added to your account: {reason}.\n\n— Your Library'
      };
  }
}

export function renderTemplate(
  template: { subject: string; body: string },
  vars: Record<string, string | number>
): { subject: string; body: string } {
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_match, key: string) =>
      vars[key] !== undefined ? String(vars[key]) : `{${key}}`
    );
  return { subject: fill(template.subject), body: fill(template.body) };
}

export async function listNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200)
  });
}
