import { Router } from 'express';
import { communicationController as comms } from '../controllers/communication.controller.js';
import { coursesController as courses } from '../controllers/courses.controller.js';
import { learningController as learning } from '../controllers/learning.controller.js';
import {
  MAX_COMPLAINT_ATTACHMENT_BYTES,
  MAX_RESOURCE_BYTES,
  MAX_SUBMISSION_BYTES,
} from '../lib/files.js';
import { requireRole } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rate-limits.js';
import { singleFile } from '../middleware/upload.js';

const staff = requireRole('admin', 'teacher');
const student = requireRole('student');
const members = requireRole('teacher', 'student');

/** Authenticated, role-aware application routes (requireAuth applied by the parent). */
export const appRoutes = Router()
  // Me
  .get('/me/courses', courses.myCourses)
  .get('/me/marks', courses.myMarks)
  .get('/me/dashboard', courses.dashboard)

  // Course-scoped
  .get('/courses/:id', courses.get)
  .get('/courses/:id/members', courses.members)
  .get('/courses/:id/resources', courses.listResources)
  .post(
    '/courses/:id/resources',
    staff,
    singleFile('file', MAX_RESOURCE_BYTES),
    courses.uploadResource,
  )
  .get('/courses/:id/assignments', courses.listAssignments)
  .post(
    '/courses/:id/assignments',
    staff,
    singleFile('attachment', MAX_RESOURCE_BYTES),
    courses.createAssignment,
  )
  .get('/courses/:id/quizzes', courses.listQuizzes)
  .post('/courses/:id/quizzes', staff, courses.createQuiz)
  .get('/courses/:id/messages', courses.listMessages)
  .post('/courses/:id/messages', members, chatLimiter, courses.sendMessage)
  .get('/courses/:id/gradebook', staff, courses.gradebook)
  .get('/courses/:id/gradebook.csv', staff, courses.gradebookCsv)

  // Resources
  .get('/resources/:id/download', learning.resourceDownload)
  .delete('/resources/:id', staff, learning.deleteResource)

  // Assignments & submissions
  .get('/assignments/:id', learning.getAssignment)
  .patch('/assignments/:id', staff, learning.updateAssignment)
  .delete('/assignments/:id', staff, learning.deleteAssignment)
  .get('/assignments/:id/attachment', learning.assignmentAttachment)
  .put(
    '/assignments/:id/submission',
    student,
    singleFile('file', MAX_SUBMISSION_BYTES),
    learning.submit,
  )
  .get('/assignments/:id/submissions', staff, learning.submissions)
  .patch('/submissions/:id/grade', staff, learning.grade)
  .get('/submissions/:id/file', learning.submissionFile)

  // Quizzes
  .get('/quizzes/:id', learning.getQuiz)
  .patch('/quizzes/:id', staff, learning.updateQuiz)
  .delete('/quizzes/:id', staff, learning.deleteQuiz)
  .post('/quizzes/:id/attempt', student, learning.startAttempt)
  .post('/quizzes/:id/attempt/submit', student, learning.submitAttempt)
  .get('/quizzes/:id/results', staff, learning.quizResults)

  // Announcements
  .get('/announcements', comms.feed)
  .post('/announcements', staff, comms.createAnnouncement)
  .get('/announcements/unread-count', comms.unreadAnnouncements)
  .post('/announcements/read', comms.markAnnouncementsRead)
  .patch('/announcements/:id', staff, comms.updateAnnouncement)
  .delete('/announcements/:id', staff, comms.deleteAnnouncement)

  // Chat
  .delete('/messages/:id', comms.deleteMessage)

  // Complaints
  .post(
    '/complaints',
    members,
    singleFile('attachment', MAX_COMPLAINT_ATTACHMENT_BYTES),
    comms.createComplaint,
  )
  .get('/complaints/mine', members, comms.myComplaints)
  .get('/complaints/:id', comms.getComplaint)
  .post('/complaints/:id/follow-up', members, comms.followUp)
  .get('/complaints/:id/attachment', comms.complaintAttachment)

  // Notifications
  .get('/notifications', comms.notifications)
  .get('/notifications/unread-count', comms.unreadNotifications)
  .post('/notifications/read-all', comms.readAllNotifications);
