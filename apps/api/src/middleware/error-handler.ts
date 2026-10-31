import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: 'The file is too large.',
  LIMIT_FILE_COUNT: 'Too many files. Upload one file at a time.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
  LIMIT_FIELD_VALUE: 'A form field is too long.',
};

/** Unknown routes: 404 in the standard error envelope. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` },
  });
}

/** Single place that turns any thrown error into { error: { code, message, details } }. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const limit = (req as Request & { uploadLimitLabel?: string }).uploadLimitLabel;
    const message =
      err.code === 'LIMIT_FILE_SIZE' && limit
        ? `The file is too large. The maximum size is ${limit}.`
        : (MULTER_MESSAGES[err.code] ?? 'Invalid upload.');
    res
      .status(status)
      .json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST', message } });
    return;
  }

  // body-parser errors (malformed JSON, body too large)
  const status = (err as { status?: number; type?: string }).status;
  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body.' } });
    return;
  }
  if (type === 'entity.too.large' || status === 413) {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }

  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
}
