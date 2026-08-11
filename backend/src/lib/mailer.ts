import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface Mailer {
  send(msg: MailMessage): Promise<{ messageId: string }>;
}

/** "json" transport — logs every message instead of sending. Used in dev/test. */
class JsonMailer implements Mailer {
  async send(msg: MailMessage): Promise<{ messageId: string }> {
    const messageId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    logger.info({ mail: { ...msg, html: undefined }, messageId }, '📧 MAIL (json transport)');
    return { messageId };
  }
}

/** Real SMTP transport via nodemailer (production / when SMTP env is set). */
class SmtpMailer implements Mailer {
  private transport: nodemailer.Transporter;

  constructor() {
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
  }

  async send(msg: MailMessage): Promise<{ messageId: string }> {
    const info = await this.transport.sendMail({ from: env.MAIL_FROM, ...msg });
    return { messageId: info.messageId };
  }
}

export const mailer: Mailer =
  env.MAIL_TRANSPORT === 'smtp' ? new SmtpMailer() : new JsonMailer();
