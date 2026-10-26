import type { ErrorRequestHandler } from 'express';
import multer from 'multer';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  void next;
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({ error: { code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_INVALID', message: tooLarge ? 'The selected file exceeds the upload limit.' : 'The upload could not be processed.' } });
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof HttpError ? error.message : 'An unexpected error occurred';
  if (status === 500) console.error(error);
  res.status(status).json({ error: { code, message } });
};

