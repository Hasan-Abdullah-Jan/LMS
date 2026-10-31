import type { Response } from 'express';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function sendPage(res: Response, data: readonly unknown[], meta: PageMeta): void {
  res.status(200).json({ data, meta });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
