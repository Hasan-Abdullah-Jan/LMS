import { supabaseAdmin } from '../config/supabase.js';
import { forbidden, notFound, unprocessable } from '../lib/errors.js';
import { buildStoragePath, MAX_RESOURCE_BYTES, verifyUpload, type UploadedFile } from '../lib/files.js';
import type { Pagination } from '../lib/pagination.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { resourcesRepository, toResource } from '../repositories/resources.repository.js';
import { storageRepository } from '../repositories/storage.repository.js';
import type { RequestContext } from '../types/auth.js';
import { assertCourseStaff, courseRole } from './access.service.js';

export const resourcesService = {
  async list(ctx: RequestContext, courseId: string, filters: Pagination & { search?: string | undefined }) {
    await courseRole(ctx, courseId);
    const { rows, total } = await resourcesRepository.list(ctx.db, courseId, filters);
    return { rows: rows.map(toResource), total };
  },

  async upload(
    ctx: RequestContext,
    courseId: string,
    file: UploadedFile | undefined,
    input: { title: string; description?: string | undefined },
  ) {
    await assertCourseStaff(ctx, courseId);
    if (!file) throw unprocessable('Choose a file to upload.', [{ path: 'file', message: 'A file is required.' }]);

    const verified = await verifyUpload(file, 'resources', MAX_RESOURCE_BYTES);
    const filePath = buildStoragePath(courseId, verified.fileName);
    await storageRepository.upload('resources', filePath, verified.buffer, verified.mimeType);

    try {
      const record = await resourcesRepository.insert(ctx.db, {
        courseId,
        uploadedBy: ctx.user.id,
        title: input.title,
        description: input.description ?? null,
        filePath,
        fileName: verified.fileName,
        mimeType: verified.mimeType,
        sizeBytes: verified.sizeBytes,
      });
      await auditRepository.record(ctx.user.id, 'resource.upload', 'resource', record.id, {
        courseId,
        fileName: record.fileName,
      });
      return toResource(record);
    } catch (err) {
      await storageRepository.remove('resources', [filePath]);
      throw err;
    }
  },

  /** 60-second signed URL for enrolled students and the course's teachers. */
  async downloadUrl(ctx: RequestContext, id: string) {
    const record = await resourcesRepository.findById(supabaseAdmin, id);
    if (!record) throw notFound('Resource');
    await courseRole(ctx, record.courseId);
    const url = await storageRepository.signedUrl('resources', record.filePath, record.fileName);
    return { url, fileName: record.fileName, expiresIn: 60 };
  },

  /** Uploader or admin. Removes the row and the storage object. */
  async remove(ctx: RequestContext, id: string) {
    const record = await resourcesRepository.findById(supabaseAdmin, id);
    if (!record) throw notFound('Resource');
    await courseRole(ctx, record.courseId);
    if (ctx.user.role !== 'admin' && record.uploaderId !== ctx.user.id) {
      throw forbidden('Only the uploader or an administrator can delete this resource.');
    }
    const deleted = await resourcesRepository.delete(ctx.db, id);
    if (!deleted) throw forbidden('Only the uploader or an administrator can delete this resource.');
    await storageRepository.remove('resources', [record.filePath]);
    await auditRepository.record(ctx.user.id, 'resource.delete', 'resource', id, {
      courseId: record.courseId,
      fileName: record.fileName,
    });
  },
};
