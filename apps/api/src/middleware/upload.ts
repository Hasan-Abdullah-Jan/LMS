import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MB } from '../lib/files.js';

/**
 * Single-file multipart parser with a per-route size limit. Files are kept in
 * memory, verified by magic bytes in the service, then streamed to storage.
 */
export function singleFile(field: string, maxBytes: number) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 20, fieldSize: 64 * 1024 },
  }).single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    (req as Request & { uploadLimitLabel?: string }).uploadLimitLabel = `${Math.round(maxBytes / MB)} MB`;
    parser(req, res, next);
  };
}
