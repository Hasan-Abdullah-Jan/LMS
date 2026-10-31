import type { Request, Response } from 'express';
import { sendData, sendNoContent, sendPage } from '../lib/http.js';
import { paginationSchema } from '../lib/pagination.js';
import { validate } from '../lib/validation.js';
import { ctx } from '../middleware/auth.js';
import { idParams } from '../schemas/common.schema.js';
import {
  announcementsQuery,
  createAnnouncementSchema,
  markReadSchema,
  updateAnnouncementSchema,
} from '../schemas/communication.schema.js';
import {
  complaintsQuery,
  createComplaintSchema,
  followUpSchema,
} from '../schemas/complaints.schema.js';
import { announcementsService } from '../services/announcements.service.js';
import { chatService } from '../services/chat.service.js';
import { complaintsService } from '../services/complaints.service.js';
import { notificationsService } from '../services/notifications.service.js';

export const communicationController = {
  // announcements
  async feed(req: Request, res: Response) {
    const query = validate(announcementsQuery, req.query);
    const { rows, total } = await announcementsService.feed(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async unreadAnnouncements(req: Request, res: Response) {
    sendData(res, await announcementsService.unreadCount(ctx(req)));
  },
  async markAnnouncementsRead(req: Request, res: Response) {
    const { upTo } = validate(markReadSchema, req.body ?? {});
    sendData(res, await announcementsService.markRead(ctx(req), upTo));
  },
  async createAnnouncement(req: Request, res: Response) {
    sendData(
      res,
      await announcementsService.create(ctx(req), validate(createAnnouncementSchema, req.body)),
      201,
    );
  },
  async updateAnnouncement(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(
      res,
      await announcementsService.update(ctx(req), id, validate(updateAnnouncementSchema, req.body)),
    );
  },
  async deleteAnnouncement(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    await announcementsService.remove(ctx(req), id);
    sendNoContent(res);
  },

  // chat
  async deleteMessage(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await chatService.remove(ctx(req), id));
  },

  // complaints
  async createComplaint(req: Request, res: Response) {
    const input = validate(createComplaintSchema, req.body ?? {});
    sendData(res, await complaintsService.create(ctx(req), input, req.file), 201);
  },
  async myComplaints(req: Request, res: Response) {
    const query = validate(complaintsQuery, req.query);
    const { rows, total } = await complaintsService.mine(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async getComplaint(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await complaintsService.get(ctx(req), id));
  },
  async followUp(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { comment } = validate(followUpSchema, req.body);
    sendData(res, await complaintsService.followUp(ctx(req), id, comment));
  },
  async complaintAttachment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await complaintsService.attachmentUrl(ctx(req), id));
  },

  // notifications
  async notifications(req: Request, res: Response) {
    const query = validate(paginationSchema, req.query);
    const { rows, total } = await notificationsService.list(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async unreadNotifications(req: Request, res: Response) {
    sendData(res, await notificationsService.unreadCount(ctx(req)));
  },
  async readAllNotifications(req: Request, res: Response) {
    await notificationsService.markAllRead(ctx(req));
    sendNoContent(res);
  },
};
