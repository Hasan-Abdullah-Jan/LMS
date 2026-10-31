import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Inclusive row range for PostgREST .range(from, to). */
export function toRange({ page, pageSize }: Pagination): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}
