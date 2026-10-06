import type { Paginated, Pagination } from '@learnloop/shared';

export const toSkipTake = ({ page, pageSize }: Pagination) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export const toPage = <T>(items: T[], total: number, p: Pagination): Paginated<T> => ({
  items,
  total,
  page: p.page,
  pageSize: p.pageSize,
});
