import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton. One client per process — creating many can exhaust
 * connection pools and is the #1 cause of "too many clients" errors.
 */
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'test'
      ? []
      : process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error']
});

export default prisma;
