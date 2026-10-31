import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { AppError, unprocessable } from './errors.js';

export const MB = 1024 * 1024;
export const MAX_RESOURCE_BYTES = 25 * MB;
export const MAX_SUBMISSION_BYTES = 25 * MB;
export const MAX_COMPLAINT_ATTACHMENT_BYTES = 10 * MB;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/** Allow-lists checked against the file's magic bytes, never its extension. */
export const ALLOWED_TYPES = {
  resources: ['application/pdf', DOCX, PPTX, 'application/zip', ...IMAGES],
  submissions: ['application/pdf', DOCX, PPTX, 'application/zip', ...IMAGES],
  complaints: ['application/pdf', DOCX, ...IMAGES],
} as const;

export type FileCategory = keyof typeof ALLOWED_TYPES;

const FRIENDLY_TYPES: Record<FileCategory, string> = {
  resources: 'PDF, DOCX, PPTX, ZIP or an image (PNG, JPG, GIF, WEBP)',
  submissions: 'PDF, DOCX, PPTX, ZIP or an image (PNG, JPG, GIF, WEBP)',
  complaints: 'PDF, DOCX or an image (PNG, JPG, GIF, WEBP)',
};

export interface UploadedFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface VerifiedFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Make a user-supplied file name safe to embed in a storage key. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '');
  return (cleaned || 'file').slice(-120);
}

/** Storage key: {scope}/{uuid}-{filename} */
export function buildStoragePath(scope: string, fileName: string): string {
  return `${scope}/${randomUUID()}-${safeFileName(fileName)}`;
}

/**
 * Verify size and real content type (magic bytes) of an uploaded file.
 * Rejects executables, renamed files and anything outside the allow-list.
 */
export async function verifyUpload(
  file: UploadedFile,
  category: FileCategory,
  maxBytes: number,
): Promise<VerifiedFile> {
  if (file.size > maxBytes) {
    throw new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      `"${file.originalname}" is too large. The maximum size is ${Math.round(maxBytes / MB)} MB.`,
    );
  }
  if (file.size === 0) throw unprocessable(`"${file.originalname}" is empty.`);

  const detected = await fileTypeFromBuffer(file.buffer);
  const allowed: readonly string[] = ALLOWED_TYPES[category];
  if (!detected || !allowed.includes(detected.mime)) {
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      `"${file.originalname}" is not an allowed file type. Upload a ${FRIENDLY_TYPES[category]}.`,
    );
  }

  return {
    buffer: file.buffer,
    fileName: safeFileName(file.originalname),
    mimeType: detected.mime,
    sizeBytes: file.size,
  };
}
