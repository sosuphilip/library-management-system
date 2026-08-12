import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Book } from '../lib/types';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Textarea
} from '../components/ui';

const COPIES_LINE_HINT = 'One per line, format: barcode:CONDITION (e.g. BC-001:NEW). Condition optional.';

interface CopyLine {
  barcode: string;
  condition: string;
}

function parseCopyLines(text: string): CopyLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [barcode, condition] = line.split(':').map((s) => s.trim());
      return { barcode, condition: (condition || 'GOOD').toUpperCase() };
    });
}

function joinAuthors(authors: { author: { name: string } }[]): string {
  return authors.map((a) => a.author.name).join(', ');
}

export default function BookFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    isbn: '',
    publisher: '',
    year: '',
    language: '',
    pageCount: '',
    coverUrl: '',
    description: '',
    authors: '',
    categories: '',
    copiesText: ''
  });
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [ready, setReady] = useState(!isEdit);

  // Load existing book when editing.
  const { data: existing, isLoading } = useQuery({
    queryKey: ['book', id ?? 'new'],
    queryFn: () => api<{ book: Book }>(`/catalog/${id}`),
    enabled: isEdit
  });

  // Populate the form once the existing book arrives (avoids a flash of empty
  // fields by gating render on `ready`).
  useEffect(() => {
    const book = existing?.book;
    if (!book) return;
    setForm({
      title: book.title,
      subtitle: book.subtitle ?? '',
      isbn: book.isbn ?? '',
      publisher: book.publisher ?? '',
      year: book.year ? String(book.year) : '',
      language: book.language ?? '',
      pageCount: book.pageCount ? String(book.pageCount) : '',
      coverUrl: book.coverUrl ?? '',
      description: book.description ?? '',
      authors: joinAuthors(book.authors),
      categories: book.categories.map((c) => c.category.name).join(', '),
      copiesText: ''
    });
    setReady(true);
  }, [existing]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = useMutation({
    mutationFn: async (): Promise<{ book?: Book }> => {
      const body: Record<string, unknown> = {
        title: form.title,
        subtitle: form.subtitle || undefined,
        isbn: form.isbn || undefined,
        publisher: form.publisher || undefined,
        year: form.year ? Number(form.year) : undefined,
        language: form.language || undefined,
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        coverUrl: form.coverUrl || undefined,
        description: form.description || undefined,
        authorNames: form.authors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        categoryNames: form.categories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      };
      if (!isEdit) {
        body.copies = parseCopyLines(form.copiesText);
      }
      return isEdit
        ? api<{ book?: Book }>(`/catalog/${id}`, { method: 'PATCH', body })
        : api<{ book?: Book }>('/catalog', { method: 'POST', body });
    },
    onSuccess: (res) => {
      navigate(isEdit ? `/catalog/${id}` : `/catalog/${res.book?.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save the book.')
  });

  const lookup = useMutation({
    mutationFn: () => api<{ book: Record<string, unknown> }>(`/catalog/isbn/${encodeURIComponent(form.isbn)}`),
    onSuccess: ({ book }) => {
      setLookupError('');
      setForm((f) => ({
        ...f,
        title: (book.title as string) ?? f.title,
        authors: (book.authors as string[])?.join(', ') ?? f.authors,
        publisher: (book.publisher as string) ?? f.publisher,
        year: book.year ? String(book.year) : f.year,
        description: (book.description as string) ?? f.description,
        pageCount: book.pageCount ? String(book.pageCount) : f.pageCount,
        coverUrl: (book.coverUrl as string) ?? f.coverUrl
      }));
    },
    onError: (err) =>
      setLookupError(err instanceof ApiError ? err.message : 'ISBN lookup failed.')
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.mutate();
  }

  if (isLoading || (isEdit && !ready)) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Edit book' : 'Add a book'}
        subtitle={isEdit ? undefined : 'Create a book with authors, categories and copies'}
        actions={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        }
      />

      <Card>
        <CardHeader title="Book information" />
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          {error && <Alert>{error}</Alert>}

          <div className="flex items-end gap-2">
            <Field label="ISBN" className="flex-1">
              <Input value={form.isbn} onChange={set('isbn')} placeholder="978-0-…" />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!form.isbn.trim()}
              loading={lookup.isPending}
              onClick={() => lookup.mutate()}
            >
              Look up
            </Button>
          </div>
          {lookupError && <p className="-mt-3 text-xs text-red-600 dark:text-red-400">{lookupError}</p>}

          <Field label="Title">
            <Input required value={form.title} onChange={set('title')} placeholder="The title of the book" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Subtitle">
              <Input value={form.subtitle} onChange={set('subtitle')} />
            </Field>
            <Field label="Authors" hint="Comma-separated names; unknown authors are created automatically">
              <Input value={form.authors} onChange={set('authors')} placeholder="Jane Doe, John Smith" />
            </Field>
            <Field label="Publisher">
              <Input value={form.publisher} onChange={set('publisher')} />
            </Field>
            <Field label="Year">
              <Input type="number" min={1000} max={2100} value={form.year} onChange={set('year')} />
            </Field>
            <Field label="Language">
              <Input value={form.language} onChange={set('language')} placeholder="English" />
            </Field>
            <Field label="Page count">
              <Input type="number" min={1} value={form.pageCount} onChange={set('pageCount')} />
            </Field>
          </div>

          <Field label="Categories" hint="Comma-separated; unknown categories are created automatically">
            <Input value={form.categories} onChange={set('categories')} placeholder="Fiction, Science" />
          </Field>

          <Field label="Cover image URL">
            <Input value={form.coverUrl} onChange={set('coverUrl')} placeholder="https://…" />
          </Field>

          <Field label="Description">
            <Textarea rows={4} value={form.description} onChange={set('description')} />
          </Field>

          {!isEdit && (
            <Field label="Copies" hint={COPIES_LINE_HINT}>
              <Textarea rows={4} value={form.copiesText} onChange={set('copiesText')} />
            </Field>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEdit ? 'Save changes' : 'Create book'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
