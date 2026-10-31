export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'ACCOUNT_DEACTIVATED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'LINK_INVALID'
  | 'DEADLINE_PASSED'
  | 'ALREADY_ATTEMPTED'
  | 'QUIZ_NOT_OPEN'
  | 'QUIZ_EXPIRED'
  | 'QUIZ_LOCKED'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  path?: string;
  message: string;
}

/** An expected, user-facing error. Anything else becomes a 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Please sign in to continue.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`);

export const conflict = (message: string, code: ErrorCode = 'CONFLICT') =>
  new AppError(409, code, message);

export const unprocessable = (message: string, details?: ErrorDetail[]) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
