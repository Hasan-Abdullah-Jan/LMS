import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/auth.js';
import { singleFile } from '../middleware/upload.js';
import { MB } from '../lib/files.js';

/** Admin-only endpoints (requireAuth is applied by the parent router). */
export const adminRoutes = Router()
  .use(requireRole('admin'))
  .get('/users', adminController.listUsers)
  .post('/users', adminController.createUser)
  .get('/users/:id', adminController.getUser)
  .patch('/users/:id', adminController.updateUser)
  .post('/users/:id/reset-password', adminController.resetUserPassword)
  .get('/courses', adminController.listCourses)
  .post('/courses', adminController.createCourse)
  .get('/courses/:id', adminController.getCourse)
  .patch('/courses/:id', adminController.updateCourse)
  .put('/courses/:id/teachers', adminController.setTeachers)
  .post('/courses/:id/enrollments', singleFile('file', 1 * MB), adminController.enroll)
  .delete('/courses/:id/enrollments/:studentId', adminController.unenroll)
  .get('/complaints', adminController.listComplaints)
  .patch('/complaints/:id', adminController.updateComplaint)
  .get('/audit-log', adminController.auditLog);
