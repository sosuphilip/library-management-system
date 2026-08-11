/**
 * Seed script — realistic demo data.
 *   npm run db:seed
 *
 * Creates: 1 admin, 1 librarian, 10 members, ~50 books with authors,
 * categories and copies, plus a few loans, fines and holds so every
 * screen in the UI has something to show.
 */
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// ------------------------------------------------------------------
// Data
// ------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Fiction', description: 'Novels and short stories' },
  { name: 'Science', description: 'Science, maths, engineering' },
  { name: 'History', description: 'History and biography' },
  { name: 'Fantasy', description: 'Fantasy and sci-fi' },
  { name: 'Computer Science', description: 'Programming and software', loanPeriodDays: 21 },
  { name: 'Philosophy', description: 'Philosophy and ethics' },
  { name: 'Poetry', description: 'Poetry collections' },
  { name: 'Reference', description: 'Reference works', loanPeriodDays: 3 }
];

// [title, author, isbn, category]
const BOOKS: Array<[string, string, string, string]> = [
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Computer Science'],
  ['The Pragmatic Programmer', 'Andrew Hunt', '9780201616224', 'Computer Science'],
  ['Design Patterns', 'Erich Gamma', '9780201633610', 'Computer Science'],
  ['Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 'Computer Science'],
  ['The Mythical Man-Month', 'Frederick P. Brooks', '9780201835953', 'Computer Science'],
  ['Structure and Interpretation of Computer Programs', 'Harold Abelson', '9780262510875', 'Computer Science'],
  ['The Art of Computer Programming, Vol. 1', 'Donald Knuth', '9780201896831', 'Computer Science'],
  ['JavaScript: The Good Parts', 'Douglas Crockford', '9780596517748', 'Computer Science'],
  ['The Cathedral and the Bazaar', 'Eric S. Raymond', '9780596001087', 'Computer Science'],
  ['Software Engineering at Google', 'Titus Winters', '9781492082798', 'Computer Science'],
  ['Pride and Prejudice', 'Jane Austen', '9780141439518', 'Fiction'],
  ['1984', 'George Orwell', '9780451524935', 'Fiction'],
  ['To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Fiction'],
  ['The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Fiction'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez', '9780060883287', 'Fiction'],
  ['The Catcher in the Rye', 'J. D. Salinger', '9780316769488', 'Fiction'],
  ['Beloved', 'Toni Morrison', '9781400033416', 'Fiction'],
  ['The Grapes of Wrath', 'John Steinbeck', '9780143039433', 'Fiction'],
  ['Crime and Punishment', 'Fyodor Dostoevsky', '9780143058144', 'Fiction'],
  ['The Old Man and the Sea', 'Ernest Hemingway', '9780684801223', 'Fiction'],
  ['The Lord of the Rings', 'J. R. R. Tolkien', '9780544003415', 'Fantasy'],
  ['Dune', 'Frank Herbert', '9780441172719', 'Fantasy'],
  ['Neuromancer', 'William Gibson', '9780441569595', 'Fantasy'],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin', '9780441478125', 'Fantasy'],
  ['Foundation', 'Isaac Asimov', '9780553293357', 'Fantasy'],
  ['Snow Crash', 'Neal Stephenson', '9780553380958', 'Fantasy'],
  ['The Hitchhiker’s Guide to the Galaxy', 'Douglas Adams', '9780345391803', 'Fantasy'],
  ['Brave New World', 'Aldous Huxley', '9780060850524', 'Fantasy'],
  ['Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', '9780062316097', 'History'],
  ['A Short History of Nearly Everything', 'Bill Bryson', '9780767908184', 'History'],
  ['The Guns of August', 'Barbara W. Tuchman', '9780345476098', 'History'],
  ['Team of Rivals', 'Doris Kearns Goodwin', '9780743270755', 'History'],
  ['Guns, Germs, and Steel', 'Jared Diamond', '9780393354324', 'History'],
  ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science'],
  ['The Selfish Gene', 'Richard Dawkins', '9780198788607', 'Science'],
  ['Cosmos', 'Carl Sagan', '9780345539435', 'Science'],
  ['The Elegant Universe', 'Brian Greene', '9780393338102', 'Science'],
  ['Silent Spring', 'Rachel Carson', '9780618249060', 'Science'],
  ['The Double Helix', 'James D. Watson', '9780743216302', 'Science'],
  ['On the Origin of Species', 'Charles Darwin', '9780451529060', 'Science'],
  ['The Republic', 'Plato', '9780140455113', 'Philosophy'],
  ['Meditations', 'Marcus Aurelius', '9780140449334', 'Philosophy'],
  ['Thus Spoke Zarathustra', 'Friedrich Nietzsche', '9780140441185', 'Philosophy'],
  ['Being and Time', 'Martin Heidegger', '9780060638504', 'Philosophy'],
  ['The Nicomachean Ethics', 'Aristotle', '9780140449495', 'Philosophy'],
  ['The Collected Poems of Emily Dickinson', 'Emily Dickinson', '9780316183451', 'Poetry'],
  ['Leaves of Grass', 'Walt Whitman', '9780140421996', 'Poetry'],
  ['The Waste Land and Other Poems', 'T. S. Eliot', '9780141185891', 'Poetry'],
  ['Selected Poems of Rainer Maria Rilke', 'Rainer Maria Rilke', '9780060937492', 'Poetry'],
  ['Complete Poems of Robert Frost', 'Robert Frost', '9780805005004', 'Poetry'],
  ['Encyclopedia Britannica', 'Editors', '9781593392925', 'Reference']
];

const MEMBER_NAMES = [
  ['Ada', 'Lovelace'],
  ['Alan', 'Turing'],
  ['Grace', 'Hopper'],
  ['Katherine', 'Johnson'],
  ['Marie', 'Curie'],
  ['Rosalind', 'Franklin'],
  ['Hedy', 'Lamarr'],
  ['Dorothy', 'Vaughan'],
  ['Barbara', 'McClintock'],
  ['Radia', 'Perlman']
];

const PASSWORD = 'Passw0rd!';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function ensureUser(email: string, firstName: string, lastName: string, role: Role) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      ...(role === 'MEMBER' ? { membershipNumber: `L-${2026}-${Math.floor(10000 + Math.random() * 90000)}` } : {})
    }
  });
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding database…');

  // Wipe existing data (seed is idempotent from a clean slate)
  const tables = [
    'RefreshToken', 'PasswordResetToken', 'Notification', 'FinePayment', 'Fine',
    'Reservation', 'Loan', 'Copy', 'BookCategory', 'BookAuthor', 'Book', 'Author',
    'Category', 'EmailTemplate', 'AuditLog', 'User'
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
  }

  // Users
  const admin = await ensureUser('admin@library.local', 'Pat', 'Director', 'ADMIN');
  const librarian = await ensureUser('librarian@library.local', 'Sam', 'Circulation', 'LIBRARIAN');
  const members = [];
  for (const [first, last] of MEMBER_NAMES) {
    members.push(
      await ensureUser(
        `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        first,
        last,
        'MEMBER'
      )
    );
  }
  console.log(`  ✓ users: 1 admin, 1 librarian, ${members.length} members`);

  // Categories
  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: c });
    categories.set(c.name, created.id);
  }

  // Authors + books
  const authorIds = new Map<string, string>();
  let copySeq = 1;
  const books = [];
  for (const [title, authorName, isbn, categoryName] of BOOKS) {
    let authorId = authorIds.get(authorName);
    if (!authorId) {
      const author = await prisma.author.create({ data: { name: authorName } });
      authorId = author.id;
      authorIds.set(authorName, authorId);
    }

    const copies =
      title === 'Dune'
        ? 3
        : ['Clean Code', '1984', 'Pride and Prejudice'].includes(title)
          ? 2
          : 1;

    const book = await prisma.book.create({
      data: {
        title,
        isbn,
        year: 1900 + (Math.floor(Math.random() * 120)),
        description: `${title} — a much-loved work in our collection.`,
        authors: { create: [{ authorId, position: 0 }] },
        categories: { create: [{ categoryId: categories.get(categoryName)! }] },
        copies: {
          create: Array.from({ length: copies }, () => ({
            barcode: `BC-${String(copySeq++).padStart(5, '0')}`,
            condition: 'GOOD' as const
          }))
        }
      },
      include: { copies: true }
    });
    books.push(book);
  }
  console.log(`  ✓ ${books.length} books, ${copySeq - 1} copies, ${authorIds.size} authors`);

  // A few demo loans on early books
  const loanCandidates = books.slice(0, 6);
  const loans = [];
  let i = 0;
  for (const book of loanCandidates) {
    const copy = book.copies[0];
    const member = members[i % members.length];
    const dueInDays = i % 3 === 0 ? -3 : 7 + i; // one overdue, rest due ahead
    const loan = await prisma.loan.create({
      data: {
        userId: member.id,
        copyId: copy.id,
        bookId: book.id,
        dueDate: new Date(Date.now() + dueInDays * 24 * 3600 * 1000),
        fineRate: 0.5,
        status: i % 2 === 0 ? 'ACTIVE' : 'RETURNED',
        ...(i % 2 === 0 ? {} : { returnedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) })
      }
    });
    await prisma.copy.update({ where: { id: copy.id }, data: { status: i % 2 === 0 ? 'CHECKED_OUT' : 'AVAILABLE' } });
    loans.push(loan);
    i++;
  }

  // One fine on the overdue loan
  const overdueLoan = loans[0];
  if (overdueLoan) {
    await prisma.fine.create({
      data: {
        userId: overdueLoan.userId,
        loanId: overdueLoan.id,
        amount: 1.5,
        balance: 1.5,
        reason: 'Late return — 3 days overdue'
      }
    });
  }

  // A couple of holds
  const heldBooks = [books[7], books[8]];
  for (const book of heldBooks) {
    const member = members[members.length - 1];
    await prisma.reservation.create({
      data: {
        bookId: book.id,
        userId: member.id,
        position: 1,
        status: 'WAITING'
      }
    });
  }

  console.log('  ✓ demo loans, fine and holds created');
  console.log('✅ Seed complete');
  console.log('\nDemo logins (password: Passw0rd!)');
  console.log(`  Admin:     admin@library.local`);
  console.log(`  Librarian: librarian@library.local`);
  console.log(`  Member:    ${members[0].email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
