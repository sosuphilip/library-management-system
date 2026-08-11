import { api, createTestUser, createLibrarian } from './helpers';
import prisma from '../src/lib/prisma';

/** Create a book via the API with a librarian token. */
async function createBook(librarian: { accessToken: string }, body: Record<string, unknown>) {
  const res = await api
    .post('/api/v1/catalog')
    .set('Authorization', `Bearer ${librarian.accessToken}`)
    .send(body)
    .expect(201);
  return res.body.book;
}

describe('Catalog', () => {
  let librarian: { accessToken: string };
  let member: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    librarian = await createLibrarian();
    member = await createTestUser();
  });

  describe('Book CRUD', () => {
    it('creates a book with authors, categories and copies', async () => {
      const book = await createBook(librarian, {
        title: 'Clean Code',
        isbn: '9780132350884',
        authorNames: ['Robert C. Martin'],
        categoryNames: ['Software Engineering'],
        year: 2008,
        publisher: 'Prentice Hall',
        copies: [
          { barcode: 'BC-0001', condition: 'GOOD' },
          { barcode: 'BC-0002', condition: 'NEW' }
        ]
      });

      expect(book.id).toBeDefined();
      expect(book.authors).toHaveLength(1);
      expect(book.authors[0].author.name).toBe('Robert C. Martin');
      expect(book.categories[0].category.name).toBe('Software Engineering');
      expect(book.copies).toHaveLength(2);
      expect(book.copies[0].status).toBe('AVAILABLE');
    });

    it('creates an author/category on the fly when they do not exist', async () => {
      const book = await createBook(librarian, {
        title: 'New World',
        authorNames: ['Unique Author Name'],
        categoryNames: ['Unique Category Name']
      });
      expect(book.authors[0].author.name).toBe('Unique Author Name');
      const category = await prisma.category.findUnique({
        where: { name: 'Unique Category Name' }
      });
      expect(category).not.toBeNull();
    });

    it('rejects duplicate ISBN', async () => {
      await createBook(librarian, { title: 'First', isbn: '9780132350884' });
      const res = await api
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ title: 'Second', isbn: '9780132350884' })
        .expect(409);
      expect(res.body.error.message).toContain('ISBN');
    });

    it('lists books with pagination', async () => {
      await createBook(librarian, { title: 'Book A', authorNames: ['Alice'] });
      await createBook(librarian, { title: 'Book B', authorNames: ['Bob'] });
      await createBook(librarian, { title: 'Book C', authorNames: ['Carol'] });

      const res = await api
        .get('/api/v1/catalog?limit=2&page=1')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('searches by title substring (case-insensitive)', async () => {
      await createBook(librarian, { title: 'The Pragmatic Programmer', authorNames: ['Hunt'] });
      await createBook(librarian, { title: 'Clean Code', authorNames: ['Martin'] });

      const res = await api
        .get('/api/v1/catalog?q=pragmatic')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('The Pragmatic Programmer');
    });

    it('searches by author name', async () => {
      await createBook(librarian, { title: 'One', authorNames: ['Jane Doe'] });
      await createBook(librarian, { title: 'Two', authorNames: ['John Smith'] });

      const res = await api
        .get('/api/v1/catalog?q=smith')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Two');
    });

    it('filters by category', async () => {
      await createBook(librarian, { title: 'Sci Book', categoryNames: ['Science'] });
      await createBook(librarian, { title: 'Fic Book', categoryNames: ['Fiction'] });

      const res = await api
        .get('/api/v1/catalog?category=Fiction')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Fic Book');
    });

    it('filters by availability', async () => {
      // Book with no copies → never "available"
      await createBook(librarian, { title: 'No Copies' });
      // Book with an available copy → shows up
      await createBook(librarian, { title: 'Has Copies', copies: [{ barcode: 'BC-A' }] });
      // Book whose only copy is checked out → hidden
      const checkedOut = await createBook(librarian, {
        title: 'Checked Out',
        copies: [{ barcode: 'BC-B' }]
      });
      await prisma.copy.update({
        where: { id: checkedOut.copies[0].id },
        data: { status: 'CHECKED_OUT' }
      });

      const res = await api
        .get('/api/v1/catalog?availability=available')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      const titles = res.body.items.map((b: { title: string }) => b.title);
      expect(titles).toEqual(['Has Copies']);
    });

    it('gets a single book with details', async () => {
      const book = await createBook(librarian, {
        title: 'Detail Book',
        copies: [{ barcode: 'BC-D1' }]
      });
      const res = await api
        .get(`/api/v1/catalog/${book.id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);
      expect(res.body.book.id).toBe(book.id);
      expect(res.body.book.copies).toHaveLength(1);
    });

    it('updates a book', async () => {
      const book = await createBook(librarian, { title: 'Old Title' });
      const res = await api
        .patch(`/api/v1/catalog/${book.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ title: 'New Title', authorNames: ['New Author'] })
        .expect(200);
      expect(res.body.book.title).toBe('New Title');
      expect(res.body.book.authors[0].author.name).toBe('New Author');
    });

    it('deletes a book (204)', async () => {
      const book = await createBook(librarian, { title: 'Doomed' });
      await api
        .delete(`/api/v1/catalog/${book.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(204);
      const gone = await prisma.book.findUnique({ where: { id: book.id } });
      expect(gone).toBeNull();
    });

    it('rejects member creating a book', async () => {
      await api
        .post('/api/v1/catalog')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('rejects unauthenticated catalog access', async () => {
      await api.get('/api/v1/catalog').expect(401);
    });
  });

  describe('Copies', () => {
    it('adds a copy to a book', async () => {
      const book = await createBook(librarian, { title: 'Copies' });
      const res = await api
        .post(`/api/v1/catalog/${book.id}/copies`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ barcode: 'BC-NEW-1', condition: 'FAIR' })
        .expect(201);
      expect(res.body.copy.bookId).toBe(book.id);
      expect(res.body.copy.barcode).toBe('BC-NEW-1');
    });

    it('rejects duplicate barcodes', async () => {
      const book = await createBook(librarian, { title: 'Dupe' });
      await api
        .post(`/api/v1/catalog/${book.id}/copies`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ barcode: 'BC-DUP', condition: 'GOOD' })
        .expect(201);
      await api
        .post(`/api/v1/catalog/${book.id}/copies`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ barcode: 'BC-DUP', condition: 'GOOD' })
        .expect(409);
    });

    it('marks a copy damaged', async () => {
      const book = await createBook(librarian, { title: 'Damage', copies: [{ barcode: 'BC-1' }] });
      const copyId = book.copies[0].id;
      const res = await api
        .patch(`/api/v1/catalog/copies/${copyId}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ status: 'DAMAGED', notes: 'Water damage' })
        .expect(200);
      expect(res.body.copy.status).toBe('DAMAGED');
      expect(res.body.copy.notes).toBe('Water damage');
    });

    it('cannot delete a copy that is checked out', async () => {
      const book = await createBook(librarian, { title: 'In Use', copies: [{ barcode: 'BC-U' }] });
      const copyId = book.copies[0].id;
      // A checked-out copy is one with an active loan (status is just denormalized).
      await prisma.loan.create({
        data: {
          copyId,
          userId: member.id,
          bookId: book.id,
          dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          fineRate: 0.5
        }
      });
      await prisma.copy.update({
        where: { id: copyId },
        data: { status: 'CHECKED_OUT' }
      });
      await api
        .delete(`/api/v1/catalog/copies/${copyId}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(409);
    });
  });

  describe('Authors', () => {
    it('lists, creates, updates and deletes authors', async () => {
      const created = await api
        .post('/api/v1/catalog/authors')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ name: 'Toni Morrison', bio: 'Nobel laureate' })
        .expect(201);

      const list = await api
        .get('/api/v1/catalog/authors')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);
      expect(list.body.items).toHaveLength(1);

      const updated = await api
        .patch(`/api/v1/catalog/authors/${created.body.author.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ bio: 'Updated bio' })
        .expect(200);
      expect(updated.body.author.bio).toBe('Updated bio');

      await api
        .delete(`/api/v1/catalog/authors/${created.body.author.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(204);
    });

    it('rejects deleting an author with books', async () => {
      const created = await api
        .post('/api/v1/catalog/authors')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ name: 'Busy Author' })
        .expect(201);
      await prisma.author.update({
        where: { id: created.body.author.id },
        data: {
          books: { create: { book: { create: { title: 'Their Book' } }, position: 0 } }
        }
      });
      await api
        .delete(`/api/v1/catalog/authors/${created.body.author.id}`)
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .expect(409);
    });
  });

  describe('Categories', () => {
    it('creates a category with a custom loan period', async () => {
      const res = await api
        .post('/api/v1/catalog/categories')
        .set('Authorization', `Bearer ${librarian.accessToken}`)
        .send({ name: 'Reference', loanPeriodDays: 3 })
        .expect(201);
      expect(res.body.category.loanPeriodDays).toBe(3);
    });
  });

  describe('ISBN lookup', () => {
    it('fetches metadata from Open Library (mocked)', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          title: 'Dune',
          authors: [{ name: 'Frank Herbert' }],
          publishers: ['Chilton'],
          publish_date: '1965',
          number_of_pages: 412,
          description: { value: 'A desert planet.' },
          covers: [12345]
        })
      } as Response);

      const res = await api
        .get('/api/v1/catalog/isbn/9780441172719')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      expect(res.body.book.title).toBe('Dune');
      expect(res.body.book.authors).toEqual(['Frank Herbert']);
      expect(res.body.book.year).toBe(1965);
      expect(res.body.book.coverUrl).toContain('12345');
      fetchMock.mockRestore();
    });

    it('returns 404 when the ISBN is unknown', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);
      await api
        .get('/api/v1/catalog/isbn/0000000000000')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(404);
      fetchMock.mockRestore();
    });
  });
});
