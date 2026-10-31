import type { Request, Response } from 'express';
import { sendData, sendNoContent, sendPage } from '../lib/http.js';
import { paginationSchema } from '../lib/pagination.js';
import { validate } from '../lib/validation.js';
import { ctx } from '../middleware/auth.js';
import { idParams } from '../schemas/common.schema.js';
import { adminUpdateComplaintSchema, complaintsQuery } from '../schemas/complaints.schema.js';
import {
  courseStudentParams,
  createCourseSchema,
  enrollQuery,
  enrollSchema,
  listCoursesQuery,
  setTeachersSchema,
  updateCourseSchema,
} from '../schemas/courses.schema.js';
import {
  adminResetPasswordSchema,
  createUserSchema,
  listUsersQuery,
  updateUserSchema,
} from '../schemas/users.schema.js';
import { complaintsService } from '../services/complaints.service.js';
import { coursesService } from '../services/courses.service.js';
import { auditService } from '../services/notifications.service.js';
import { usersService } from '../services/users.service.js';

export const adminController = {
  // users
  async listUsers(req: Request, res: Response) {
    const query = validate(listUsersQuery, req.query);
    const { rows, total } = await usersService.list(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async getUser(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await usersService.get(ctx(req), id));
  },
  async createUser(req: Request, res: Response) {
    sendData(res, await usersService.create(ctx(req), validate(createUserSchema, req.body)), 201);
  },
  async updateUser(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await usersService.update(ctx(req), id, validate(updateUserSchema, req.body)));
  },
  async resetUserPassword(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(
      res,
      await usersService.resetPassword(ctx(req), id, validate(adminResetPasswordSchema, req.body)),
    );
  },

  // courses
  async listCourses(req: Request, res: Response) {
    const query = validate(listCoursesQuery, req.query);
    const { rows, total } = await coursesService.list(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async getCourse(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(res, await coursesService.getForAdmin(ctx(req), id));
  },
  async createCourse(req: Request, res: Response) {
    sendData(
      res,
      await coursesService.create(ctx(req), validate(createCourseSchema, req.body)),
      201,
    );
  },
  async updateCourse(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(
      res,
      await coursesService.update(ctx(req), id, validate(updateCourseSchema, req.body)),
    );
  },
  async setTeachers(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { teacherIds } = validate(setTeachersSchema, req.body);
    sendData(res, await coursesService.setTeachers(ctx(req), id, teacherIds));
  },
  async enroll(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    const { dryRun } = validate(enrollQuery, req.query);
    const body = req.file ? { csv: req.file.buffer.toString('utf8') } : req.body;
    const report = await coursesService.enroll(ctx(req), id, validate(enrollSchema, body), dryRun);
    sendData(res, report, dryRun ? 200 : 201);
  },
  async unenroll(req: Request, res: Response) {
    const { id, studentId } = validate(courseStudentParams, req.params);
    await coursesService.unenroll(ctx(req), id, studentId);
    sendNoContent(res);
  },

  // complaints
  async listComplaints(req: Request, res: Response) {
    const query = validate(complaintsQuery, req.query);
    const { rows, total } = await complaintsService.adminList(ctx(req), query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
  async updateComplaint(req: Request, res: Response) {
    const { id } = validate(idParams, req.params);
    sendData(
      res,
      await complaintsService.adminUpdate(
        ctx(req),
        id,
        validate(adminUpdateComplaintSchema, req.body),
      ),
    );
  },

  // audit
  async auditLog(req: Request, res: Response) {
    const query = validate(paginationSchema, req.query);
    const { rows, total } = await auditService.list(query);
    sendPage(res, rows, { page: query.page, pageSize: query.pageSize, total });
  },
};
