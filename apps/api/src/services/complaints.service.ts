import { supabaseAdmin } from '../config/supabase.js';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import {
  buildStoragePath,
  MAX_COMPLAINT_ATTACHMENT_BYTES,
  verifyUpload,
  type UploadedFile,
} from '../lib/files.js';
import { auditRepository } from '../repositories/audit.repository.js';
import {
  complaintsRepository,
  toComplaint,
  type ComplaintCategory,
  type ComplaintFilters,
  type ComplaintStatus,
} from '../repositories/complaints.repository.js';
import { notificationsRepository } from '../repositories/notifications.repository.js';
import { storageRepository } from '../repositories/storage.repository.js';
import type { RequestContext } from '../types/auth.js';
import { courseRole } from './access.service.js';

/** open -> in_review -> resolved | rejected */
export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['in_review'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: 'open',
  in_review: 'in review',
  resolved: 'resolved',
  rejected: 'rejected',
};

async function requireVisible(ctx: RequestContext, id: string) {
  const complaint = await complaintsRepository.findById(supabaseAdmin, id);
  // 404 (not 403) for other users' complaints: existence is not revealed.
  if (!complaint || (ctx.user.role !== 'admin' && complaint.raisedById !== ctx.user.id)) {
    throw notFound('Complaint');
  }
  return complaint;
}

export const complaintsService = {
  async create(
    ctx: RequestContext,
    input: {
      category: ComplaintCategory;
      subject: string;
      description: string;
      courseId: string | null;
    },
    file: UploadedFile | undefined,
  ) {
    if (ctx.user.role === 'admin')
      throw forbidden('Administrators resolve complaints rather than file them.');
    if (input.courseId) await courseRole(ctx, input.courseId);

    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    if (file) {
      const verified = await verifyUpload(file, 'complaints', MAX_COMPLAINT_ATTACHMENT_BYTES);
      attachmentPath = buildStoragePath(ctx.user.id, verified.fileName);
      attachmentName = verified.fileName;
      await storageRepository.upload(
        'complaint-attachments',
        attachmentPath,
        verified.buffer,
        verified.mimeType,
      );
    }
    try {
      const record = await complaintsRepository.insert(ctx.db, {
        ...input,
        raisedBy: ctx.user.id,
        attachmentPath,
        attachmentName,
      });
      return toComplaint(record);
    } catch (err) {
      if (attachmentPath) await storageRepository.remove('complaint-attachments', [attachmentPath]);
      throw err;
    }
  },

  async mine(ctx: RequestContext, filters: ComplaintFilters) {
    if (ctx.user.role === 'admin') throw forbidden('Administrators do not file complaints.');
    const { rows, total } = await complaintsRepository.list(ctx.db, {
      ...filters,
      raisedBy: ctx.user.id,
    });
    return { rows: rows.map(toComplaint), total };
  },

  async get(ctx: RequestContext, id: string) {
    return toComplaint(await requireVisible(ctx, id));
  },

  async adminList(ctx: RequestContext, filters: ComplaintFilters) {
    const { rows, total } = await complaintsRepository.list(ctx.db, filters);
    return { rows: rows.map(toComplaint), total };
  },

  /** Admin review. A response is required to resolve or reject (422). The complainant is notified. */
  async adminUpdate(
    ctx: RequestContext,
    id: string,
    input: { status?: ComplaintStatus | undefined; adminResponse?: string | undefined },
  ) {
    const complaint = await complaintsRepository.findById(ctx.db, id);
    if (!complaint) throw notFound('Complaint');

    const nextStatus = input.status ?? complaint.status;
    const statusChanges = nextStatus !== complaint.status;
    if (statusChanges && !ALLOWED_TRANSITIONS[complaint.status].includes(nextStatus)) {
      throw unprocessable(
        `A complaint that is ${STATUS_LABEL[complaint.status]} cannot be moved to ${STATUS_LABEL[nextStatus]}.`,
        [{ path: 'status', message: 'Invalid status change.' }],
      );
    }
    if (!statusChanges && ['resolved', 'rejected'].includes(complaint.status)) {
      throw conflict('This complaint is closed and can no longer be changed.');
    }
    const response = input.adminResponse ?? complaint.adminResponse ?? '';
    if ((nextStatus === 'resolved' || nextStatus === 'rejected') && !response.trim()) {
      throw unprocessable('A response is required to resolve or reject a complaint.', [
        {
          path: 'adminResponse',
          message: 'A response is required to resolve or reject a complaint.',
        },
      ]);
    }

    const updated = await complaintsRepository.update(ctx.db, id, {
      status: statusChanges ? nextStatus : undefined,
      adminResponse: input.adminResponse,
    });

    if (statusChanges) {
      await notificationsRepository.create({
        userId: complaint.raisedById,
        kind: 'complaint_status',
        title: `Complaint ${STATUS_LABEL[nextStatus]}`,
        body: `Your complaint "${complaint.subject}" is now ${STATUS_LABEL[nextStatus]}.`,
        link: `/complaints?open=${id}`,
      });
    }
    await auditRepository.record(ctx.user.id, 'complaint.update', 'complaint', id, {
      ...(statusChanges && { from: complaint.status, to: nextStatus }),
      responded: input.adminResponse !== undefined,
    });
    return toComplaint(updated);
  },

  /** Complainants may add exactly one follow-up comment. */
  async followUp(ctx: RequestContext, id: string, comment: string) {
    const complaint = await requireVisible(ctx, id);
    if (complaint.raisedById !== ctx.user.id) throw notFound('Complaint');
    if (complaint.followUp) throw conflict('You have already added a follow-up to this complaint.');
    return toComplaint(await complaintsRepository.update(ctx.db, id, { followUp: comment }));
  },

  async attachmentUrl(ctx: RequestContext, id: string) {
    const complaint = await requireVisible(ctx, id);
    if (!complaint.attachmentPath || !complaint.attachmentName) throw notFound('Attachment');
    const url = await storageRepository.signedUrl(
      'complaint-attachments',
      complaint.attachmentPath,
      complaint.attachmentName,
    );
    return { url, fileName: complaint.attachmentName, expiresIn: 60 };
  },
};
