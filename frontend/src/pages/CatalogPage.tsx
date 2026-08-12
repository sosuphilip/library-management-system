import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Book, Category, Paginated } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CoverImage,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Pagination,
  Select
} from '../components/ui';

const PAGE_SIZE = 12;

function bookAuthorList(book: Book): string {
  return book.authors.map((a) => a.author.name).join(', ') || 'Unknown author';
}

function BookCard({ book }: { book: Book }) {
  const available = book.copies.filter((c) => c.status === 'AVAILABLE').length;
  const total = book.copies.length;
  const inStock = available > 0;

  return (
    <Link
      to={`/catalog/${book.id}`}
      className="group block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:shadow-black/40"
    >
      <div className="flex items-start gap-4">
        <CoverImage
          title={book.title}
          src={book.coverUrl}
          className="h-24 w-16 shrink-0 rounded-md shadow-sm transition-transform duration-200 group-hover:scale-[1.04]"
        />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
            {book.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{bookAuthorList(book)}</p>
          {book.year && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{book.year}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {inStock ? (
              <Badge status="AVAILABLE">
                {available} of {total} available
              </Badge>
            ) : (
              <Badge status="CHECKED_OUT">Checked out</Badge>
            )}
            {book.categories.map((c) => (
              <span
                key={c.category.id}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300"
              >
                {c.category.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CatalogPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'LIBRARIAN';

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState<'all' | 'available'>('all');
  const [page, setPage] = useState(1);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Paginated<Category>>('/catalog/categories?limit=100')
  });

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    page: String(page)
  });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (availability === 'available') params.set('availability', 'available');

  const booksQuery = useQuery({
    queryKey: ['catalog', q, category, availability, page],
    queryFn: () => api<Paginated<Book>>(`/catalog?${params}`)
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  const data = booksQuery.data;

  return (
    <div>
      <PageHeader
        title="Catalog"
        subtitle="Browse, search and reserve books"
        actions={
          isStaff ? (
            <Link to="/catalog/new">
              <Button>+ Add book</Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-6 p-4">
        <form onSubmit={onSearch} className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <Field label="Search" className="md:col-span-6">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title, author, ISBN, publisher…"
            />
          </Field>
          <Field label="Category" className="md:col-span-3">
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {(categoriesQuery.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Availability" className="md:col-span-2">
            <Select
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value as 'all' | 'available');
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="available">Available now</option>
            </Select>
          </Field>
          <div className="flex items-end md:col-span-1">
            <Button type="submit" variant="secondary" className="w-full">
              Search
            </Button>
          </div>
        </form>
      </Card>

      {booksQuery.isLoading ? (
        <LoadingBlock />
      ) : booksQuery.isError ? (
        <Alert>{booksQuery.error instanceof Error ? booksQuery.error.message : 'Failed to load the catalog.'}</Alert>
      ) : data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No books found"
            message="Try a different search term or clear the filters."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ('');
                  setCategory('');
                  setAvailability('all');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.items ?? []).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          <Pagination
            page={data?.pagination.page ?? 1}
            totalPages={data?.pagination.totalPages ?? 1}
            total={data?.pagination.total ?? 0}
            onPage={setPage}
            pageSizeLabel={`${data?.items.length ?? 0} books`}
          />
        </>
      )}
    </div>
  );
}
