import app from './app';
import { env } from './config/env';
import prisma from './lib/prisma';
import { logger } from './lib/logger';
import { startNotificationCron } from './jobs/notification-cron';

async function main(): Promise<void> {
  try {
    // Fail fast if the DB is unreachable
    await prisma.$connect();
    logger.info('Connected to database');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    process.exit(1);
  }

  // Daily notification sweep — skipped in tests (started explicitly there)
  if (env.NODE_ENV !== 'test') {
    startNotificationCron();
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ error }, 'Fatal startup error');
  process.exit(1);
});
