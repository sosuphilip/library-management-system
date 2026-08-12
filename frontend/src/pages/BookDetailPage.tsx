import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Book, MemberListItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CoverImage,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select
} from '../components/ui';
import { MemberPicker } from '../components/MemberPicker';
import { formatDate, formatDateTime, fullName } from '../lib/format';

const COPY_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;

export default function BookDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'LIBRARIAN';

  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [checkoutCopyId, setCheckoutCopyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCopy, setNewCopy] = useState({ barcode: '', condition: 'GOOD' as (typeof COPY_CONDITIONS)[number] });

  const bookQuery = useQuery({
    queryKey: ['book', id],
    queryFn: () => api<{ book: Book }>(`/catalog/${id}`)
  });
  const book = bookQuery.data?.book;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['book', id] });
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
  };

  // ---------------- Mutations ----------------

  const reserve = useMutation({
    mutationFn: () => api('/circulation/reserve', { method: 'POST', body: { bookId: id } }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Hold placed on this book.' });
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not place the hold.' })
  });

  const checkout = useMutation({
    mutationFn: (body: { copyId: string; userId: string }) =>
      api('/circulation/checkout', { method: 'POST', body }),
    onSuccess: () => {
      setFlash({ kind: 'success', text: 'Copy checked out.' });
      setCheckoutCopyId(null);
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Checkout failed.' })
  });

  const addCopy = useMutation({
    mutationFn: () =>
      api(`/catalog/${id}/copies`, { method: 'POST', body: newCopy }),
    onSuccess: () => {
      setNewCopy({ barcode: '', condition: 'GOOD' });
      setAddOpen(false);
      invalidate();
    },
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not add the copy.' })
  });

  const markDamaged = useMutation({
    mutationFn: (copyId: string) =>
      api(`/catalog/copies/${copyId}`, { method: 'PATCH', body: { status: 'DAMAGED' } }),
    onSuccess: () => invalidate(),
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Update failed.' })
  });

  const deleteCopy = useMutation({
    mutationFn: (copyId: string) => api(`/catalog/copies/${copyId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Delete failed.' })
  });

  const deleteBook = useMutation({
    mutationFn: () => api(`/catalog/${id}`, { method: 'DELETE' }),
    onSuccess: () => navigate('/catalog'),
    onError: (err) => setFlash({ kind: 'error', text: err instanceof ApiError ? err.message : 'Delete failed.' })
  });

  // ---------------- Render ----------------

  if (bookQuery.isLoading) return <LoadingBlock />;
  if (bookQuery.isError || !book) {
    return (
      <Alert>
        {bookQuery.error instanceof Error ? bookQuery.error.message : 'Book not found.'}
      </Alert>
    );
  }

  const authorNames = book.authors.map((a) => a.author.name).join(', ');
  const availableCopies = book.copies.filter((c) => c.status === 'AVAILABLE');

  return (
    <div>
      <PageHeader
        title={book.title}
        subtitle={authorNames || undefined}
        actions={
          <>
            <Link to="/catalog">
              <Button variant="secondary">← Back to catalog</Button>
            </Link>
            {isStaff && (
              <>
                <Link to={`/catalog/${book.id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm('Delete this book permanently?')) deleteBook.mutate();
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />

      {flash && (
        <div className="mb-4">
          <Alert kind={flash.kind}>{flash.text}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Info */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center p-6">
            <CoverImage
              title={book.title}
              src={book.coverUrl}
              className="h-64 w-44 rounded-md shadow-lg transition-shadow duration-200 hover:shadow-xl"
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {book.categories.map((c) => (
                <span key={c.category.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {c.category.name}
                </span>
              ))}
            </div>
            <Button
              variant="accent"
              className="mt-5 w-full"
              disabled={availableCopies.length === 0}
              loading={reserve.isPending}
              onClick={() => reserve.mutate()}
            >
              {availableCopies.length > 0 ? 'Place a hold' : 'Place a hold (waitlist)'}
            </Button>
            {availableCopies.length === 0 && (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">No copies available — you'll join the waitlist.</p>
            )}
          </div>
        </Card>

        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-3">
            <Detail label="Author(s)" value={authorNames || '—'} />
            <Detail label="ISBN" value={book.isbn || '—'} />
            <Detail label="Publisher" value={book.publisher || '—'} />
            <Detail label="Year" value={book.year ? String(book.year) : '—'} />
            <Detail label="Language" value={book.language || '—'} />
            <Detail label="Pages" value={book.pageCount ? String(book.pageCount) : '—'} />
            <Detail label="Copies" value={String(book.copies.length)} />
            <Detail label="Available" value={String(availableCopies.length)} />
          </dl>
          {book.description && (
            <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Description</h3>
              <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{book.description}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Copies */}
      <Card className="mt-6">
        <CardHeader
          title={`Copies (${book.copies.length})`}
          actions={
            isStaff ? (
              <Button variant="secondary" onClick={() => setAddOpen((v) => !v)}>
                {addOpen ? 'Cancel' : '+ Add copy'}
              </Button>
            ) : undefined
          }
        />
        {addOpen && (
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/60">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                addCopy.mutate();
              }}
            >
              <Field label="Barcode" className="w-56">
                <Input
                  required
                  value={newCopy.barcode}
                  onChange={(e) => setNewCopy((c) => ({ ...c, barcode: e.target.value }))}
                  placeholder="BC-0000"
                />
              </Field>
              <Field label="Condition" className="w-36">
                <Select
                  value={newCopy.condition}
                  onChange={(e) =>
                    setNewCopy((c) => ({ ...c, condition: e.target.value as typeof COPY_CONDITIONS[number] }))
                  }
                >
                  {COPY_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" loading={addCopy.isPending}>
                Add copy
              </Button>
            </form>
          </div>
        )}

        {book.copies.length === 0 ? (
          <EmptyState title="No copies yet" message="Add a copy so members can check it out." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {book.copies.map((copy) => (
              <li key={copy.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{copy.barcode}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                    {copy.condition}
                  </span>
                  <Badge status={copy.status} />
                  {copy.dueDate && copy.status === 'CHECKED_OUT' && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">due {formatDate(copy.dueDate)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isStaff && copy.status === 'AVAILABLE' && (
                    <Button variant="secondary" onClick={() => setCheckoutCopyId(checkoutCopyId === copy.id ? null : copy.id)}>
                      Check out
                    </Button>
                  )}
                  {isStaff && copy.status !== 'DAMAGED' && (
                    <Button variant="ghost" onClick={() => markDamaged.mutate(copy.id)}>
                      Mark damaged
                    </Button>
                  )}
                  {isStaff && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete copy ${copy.barcode}?`)) deleteCopy.mutate(copy.id);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {checkoutCopyId === copy.id && (
                  <div className="w-full border-t border-slate-100 pt-3 dark:border-slate-700">
                    <CheckoutForm
                      copyId={copy.id}
                      copyLabel={copy.barcode}
                      onMember={(member) => checkout.mutate({ copyId: copy.id, userId: member.id })}
                      busy={checkout.isPending}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recent loans */}
      {isStaff && book.loans && book.loans.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Recent loans" />
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {book.loans.map((loan) => (
              <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {loan.user ? fullName(loan.user.firstName, loan.user.lastName) : '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {loan.copy?.barcode} · checked out {formatDateTime(loan.checkedOutAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={loan.status} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {loan.status === 'RETURNED'
                      ? `returned ${formatDate(loan.returnedAt)}`
                      : `due ${formatDate(loan.dueDate)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}

function CheckoutForm({
  copyId,
  copyLabel,
  onMember,
  busy
}: {
  copyId: string;
  copyLabel: string;
  onMember: (m: MemberListItem) => void;
  busy: boolean;
}) {
  const [picked, setPicked] = useState<MemberListItem | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <MemberPicker
        onSelect={(m) => {
          setPicked(m);
          onMember(m);
        }}
        resetKey={copyId}
      />
      <p className="text-sm text-slate-500 md:py-2 dark:text-slate-400">
        {busy
          ? 'Checking out…'
          : picked
            ? `Checking out ${copyLabel} to ${fullName(picked.firstName, picked.lastName)}`
            : 'Search and select a member to check out this copy.'}
      </p>
    </div>
  );
}
