import type { Request, Response } from 'express';
import { sendData, sendNoContent } from '../lib/http.js';
import { validate } from '../lib/validation.js';
import { ctx } from '../middleware/auth.js';
import { gradeSchema, submitSchema, updateAssignmentSchema } from '../schemas/assignments.schema.js';
import { idParams } from '../schemas/common.schema.js';
import { submitAttemptSchema, updateQuizSchema } from '../schemas/quizzes.schema.js';
import { assignmentsService } from '../services/assignments.service.js';
import { quizzesService } from '../services/quizzes.service.js';
import { resourcesService } from '../services/resources.service.js';

/** Item-level routes for resources, assignments, submissions and quizzes. */
export const learningController = {
  async resourceDownload(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await resourcesService.downloadUrl(ctx(req), id));
  },
  async deleteResource(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    await resourcesService.remove(ctx(req), id);
    sendNoContent(res);
  },

  async getAssignment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.get(ctx(req), id));
  },
  async updateAssignment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.update(ctx(req), id, validate(updateAssignmentSchema, req.body)));
  },
  async deleteAssignment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    await assignmentsService.remove(ctx(req), id);
    sendNoContent(res);
  },
  async assignmentAttachment(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.attachmentUrl(ctx(req), id));
  },
  async submit(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const input = validate(submitSchema, req.body ?? {});
    sendData(res, await assignmentsService.submit(ctx(req), id, input, req.file));
  },
  async submissions(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.submissions(ctx(req), id));
  },
  async grade(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.grade(ctx(req), id, validate(gradeSchema, req.body)));
  },
  async submissionFile(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await assignmentsService.submissionFileUrl(ctx(req), id));
  },

  async getQuiz(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await quizzesService.get(ctx(req), id));
  },
  async updateQuiz(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await quizzesService.update(ctx(req), id, validate(updateQuizSchema, req.body)));
  },
  async deleteQuiz(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    await quizzesService.remove(ctx(req), id);
    sendNoContent(res);
  },
  async startAttempt(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await quizzesService.startAttempt(ctx(req), id));
  },
  async submitAttempt(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { answers } = validate(submitAttemptSchema, req.body);
    sendData(res, await quizzesService.submitAttempt(ctx(req), id, answers));
  },
  async quizResults(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await quizzesService.results(ctx(req), id));
  },
};
