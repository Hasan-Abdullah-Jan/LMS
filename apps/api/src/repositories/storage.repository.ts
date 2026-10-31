import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

export type Bucket = 'resources' | 'submissions' | 'complaint-attachments';

export const SIGNED_URL_TTL_SECONDS = 60;

/** Private-bucket storage access. Callers must authorize before using these. */
export const storageRepository = {
  async upload(bucket: Bucket, path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: false });
    if (error) {
      logger.error({ err: error.message, bucket }, 'Storage upload failed');
      throw new AppError(500, 'INTERNAL_ERROR', 'The file could not be stored. Please try again.');
    }
  },

  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    const targets = paths.filter(Boolean);
    if (targets.length === 0) return;
    const { error } = await supabaseAdmin.storage.from(bucket).remove(targets);
    if (error) logger.error({ err: error.message, bucket }, 'Storage delete failed');
  },

  async signedUrl(bucket: Bucket, path: string, downloadName: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: downloadName });
    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'File not found.');
    return data.signedUrl;
  },
};
