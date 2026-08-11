export interface Pagination {
  page: number;
  limit: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** Parse and clamp `?page=&limit=` query params. */
export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const requestedLimit = Math.floor(Number(query.limit) || DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
  return { page, limit };
}

/** Turn a pagination object into Prisma `take`/`skip`. */
export function prismaPagination({ page, limit }: Pagination): { take: number; skip: number } {
  return { take: limit, skip: (page - 1) * limit };
}

/** Build the response envelope for any list endpoint. */
export function buildPaginated<T>(
  items: T[],
  total: number,
  { page, limit }: Pagination
): Paginated<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
