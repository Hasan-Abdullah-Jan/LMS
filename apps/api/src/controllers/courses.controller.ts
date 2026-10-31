import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendData, sendPage } from '../lib/http.js';
import { paginationSchema } from '../lib/pagination.js';
import { validate } from '../lib/validation.js';
import { ctx } from '../middleware/auth.js';
import { createAssignmentSchema } from '../schemas/assignments.schema.js';
import { idParams, optionalText, requiredText, uuidSchema } from '../schemas/common.schema.js';
import { messagesQuery, sendMessageSchema } from '../schemas/communication.schema.js';
import { createQuizSchema } from '../schemas/quizzes.schema.js';
import { assignmentsService } from '../services/assignments.service.js';
import { chatService } from '../services/chat.service.js';
import { coursesService } from '../services/courses.service.js';
import { dashboardService } from '../services/dashboard.service.js';
import { marksService } from '../services/marks.service.js';
import { quizzesService } from '../services/quizzes.service.js';
import { resourcesService } from '../services/resources.service.js';

const resourceListQuery = paginationSchema.extend({ search: optionalText(100) });
const resourceUploadSchema = z.object({
  title: requiredText('Title', 1, 200),
  description: optionalText(2000),
});
const marksQuery = z.object({ courseId: uuidSchema.optional(), studentId: uuidSchema.optional() });

export const coursesController = {
  // /me
  async myCourses(req: Request, res: Response) {
    sendData(res, await coursesService.myCourses(ctx(req)));
  },
  async myMarks(req: Request, res: Response) {
    const { courseId, studentId } = validate(marksQuery, req.query);
    sendData(res, await marksService.myMarks(ctx(req), courseId, studentId));
  },
  async dashboard(req: Request, res: Response) {
    sendData(res, await dashboardService.summary(ctx(req)));
  },

  // /courses/:id
  async get(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await coursesService.getForMember(ctx(req), id));
  },
  async members(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await coursesService.members(ctx(req), id));
  },

  async listResources(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const query = validate(resourceListQuery, req.query);
    const { rows, total } = await resourcesService.list(ctx(req), id, query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async uploadResource(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const input = validate(resourceUploadSchema, req.body ?? {});
    sendData(res, await resourcesService.upload(ctx(req), id, req.file, input), 201);
  },

  async listAssignments(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const query = validate(paginationSchema, req.query);
    const { rows, total } = await assignmentsService.list(ctx(req), id, query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async createAssignment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const input = validate(createAssignmentSchema, req.body ?? {});
    sendData(res, await assignmentsService.create(ctx(req), id, input, req.file), 201);
  },

  async listQuizzes(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const quizzes = await quizzesService.list(ctx(req), id);
    sendPage(res, quizzes, { page: 1, pageSize: quizzes.length, total: quizzes.length });
  },
  async createQuiz(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await quizzesService.create(ctx(req), id, validate(createQuizSchema, req.body)), 201);
  },

  async listMessages(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { before, limit } = validate(messagesQuery, req.query);
    const { messages, hasMore } = await chatService.history(ctx(req), id, before, limit);
    res.json({ data: messages, meta: { hasMore, nextBefore: hasMore ? (messages[0]?.createdAt ?? null) : null } });
  },
  async sendMessage(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { body } = validate(sendMessageSchema, req.body);
    sendData(res, await chatService.send(ctx(req), id, body), 201);
  },

  async gradebook(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await marksService.gradebook(ctx(req), id));
  },
  async gradebookCsv(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { fileName, csv } = await marksService.gradebookCsv(ctx(req), id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  },
};
