// TypeScript mirror of the backend API DTOs (see backend/src/services).

export type Role = 'ADMIN' | 'LIBRARIAN' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  status: UserStatus;
  membershipNumber: string | null;
  suspendedUntil: string | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------

export interface Author {
  id: string;
  name: string;
  bio: string | null;
  _count?: { books: number };
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  loanPeriodDays: number | null;
  _count?: { books: number };
}

export type CopyStatus = 'AVAILABLE' | 'CHECKED_OUT' | 'LOST' | 'DAMAGED' | 'IN_REPAIR';
export type CopyCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface Copy {
  id: string;
  barcode: string;
  status: CopyStatus;
  condition: CopyCondition;
  notes: string | null;
  bookId: string;
  dueDate: string | null;
}

export interface BookAuthor {
  authorId: string;
  position: number;
  author: Author;
}

export interface BookCategory {
  categoryId: string;
  category: Category;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  language: string | null;
  description: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  authors: BookAuthor[];
  categories: BookCategory[];
  copies: Copy[];
  loans?: Loan[];
  /** Present on report endpoints that aggregate checkout counts. */
  _count?: { loans: number };
}

// ---------------------------------------------------------------
// Circulation
// ---------------------------------------------------------------

export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'LOST';

export interface Loan {
  id: string;
  userId: string;
  copyId: string;
  bookId: string;
  status: LoanStatus;
  checkedOutAt: string;
  dueDate: string;
  returnedAt: string | null;
  renewals: number;
  maxRenewals: number;
  fineRate: string;
  copy?: Copy & { book: Book };
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  fines?: Fine[];
}

export type FineStatus = 'UNPAID' | 'PAID' | 'WAIVED';

export interface Fine {
  id: string;
  userId: string;
  loanId: string | null;
  amount: string;
  balance: string;
  status: FineStatus;
  reason: string | null;
  createdAt: string;
  settledAt: string | null;
  loan?: Loan;
}

export type ReservationStatus = 'WAITING' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface Reservation {
  id: string;
  bookId: string;
  userId: string;
  status: ReservationStatus;
  position: number;
  copyId: string | null;
  createdAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  book?: Book;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------
// Admin
// ---------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'> | null;
}

export interface EmailTemplate {
  type: string;
  subject: string;
  body: string;
  isDefault: boolean;
  updatedAt: string | null;
}

// ---------------------------------------------------------------
// Members & reports
// ---------------------------------------------------------------

export interface MemberListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  suspendedUntil: string | null;
  membershipNumber: string | null;
  createdAt: string;
  _count: { loans: number; fines: number };
}

export interface MemberDossier {
  member: MemberListItem;
  stats: {
    totalLoans: number;
    activeLoans: number;
    overdueLoans: number;
    unpaidFines: number;
  };
  activeLoans: Loan[];
  loanHistory: Loan[];
  reservations: Reservation[];
  fines: Fine[];
}

export interface DashboardStats {
  books: number;
  copies: number;
  activeLoans: number;
  overdueLoans: number;
  members: number;
  outstandingFines: number;
  collectedFines: number;
  waivedFines: number;
}
