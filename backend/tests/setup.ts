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
  // Table names are PascalCase (e.g. `User`, `RefreshToken`) and `USER` is a
  // reserved keyword, so each must be double-quoted in the raw SQL.
  const quoted = TABLES.map((t) => `"${t}"`).join(',');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
