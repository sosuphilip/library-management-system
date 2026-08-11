import prisma from '../src/lib/prisma';

const TABLES = [
  'RefreshToken',
  'PasswordResetToken',
  'Notification',
  'FinePayment',
  'Fine',
  'Reservation',
  'Loan',
  'Copy',
  'BookCategory',
  'BookAuthor',
  'Book',
  'Author',
  'Category',
  'EmailTemplate',
  'AuditLog',
  'User'
];

beforeAll(async () => {
  // Ensure the test schema exists (migrations are applied by CI / before test run).
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(',')} RESTART IDENTITY CASCADE`
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
