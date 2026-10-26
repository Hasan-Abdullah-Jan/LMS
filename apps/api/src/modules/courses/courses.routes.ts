import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/errors.js';
import { createCourse, coursePeople, enroll, getCourse, listCourses, listMyCourses, replaceEnrollments, replaceTeachers, resolveEmails, unenroll, updateCourse } from './courses.service.js';
import { coursePatchSchema, courseSchema, enrollmentSchema, paginationSchema, teacherSetSchema } from './courses.schemas.js';
import { adminClient } from '../../config/supabase.js';

const router=Router();const csvUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:1_000_000}});
router.get('/me/courses',requireAuth,asyncHandler(async(req,res)=>{const q=paginationSchema.safeParse(req.query);if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid pagination');const result=await listMyCourses({id:req.user!.id,role:req.user!.role},req.user!.accessToken,q.data.page,q.data.pageSize);res.json(result)}));
router.get('/courses/:id',requireAuth,asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');res.json({data:await getCourse(id.data,req.user!.accessToken)})}));
router.get('/admin/courses',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const q=paginationSchema.safeParse(req.query);if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid pagination');res.json(await listCourses(q.data))}));
router.post('/admin/courses',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const q=courseSchema.safeParse(req.body);if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid course details');res.status(201).json({data:await createCourse(q.data)})}));
router.patch('/admin/courses/:id',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);const q=coursePatchSchema.safeParse(req.body);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid course details');res.json({data:await updateCourse(id.data,q.data)})}));
router.put('/admin/courses/:id/teachers',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);const q=teacherSetSchema.safeParse(req.body);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid teachers');const {data}=await adminClient().from('courses').select('id').eq('id',id.data).maybeSingle();if(!data)throw new HttpError(404,'NOT_FOUND','Course not found');res.json({data:await replaceTeachers(id.data,q.data.teacherIds)})}));
router.post('/admin/courses/:id/enrollments',requireAuth,requireRole('admin'),csvUpload.single('file'),asyncHandler(async(req,res)=>{
  const id=z.string().uuid().safeParse(req.params.id);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');
  const {data:course}=await adminClient().from('courses').select('id').eq('id',id.data).maybeSingle();if(!course)throw new HttpError(404,'NOT_FOUND','Course not found');
  if(req.file){if(!req.file.originalname.toLowerCase().endsWith('.csv'))throw new HttpError(422,'INVALID_CSV','Upload a CSV file');const emails=req.file.buffer.toString('utf8').split(/[\r\n,;]+/).map(v=>v.trim()).filter(v=>v&&v.toLowerCase()!=='email');const result=await resolveEmails(emails);if(req.query.preview==='true'){res.json({data:result});return;}await enroll(id.data,result.studentIds);res.json({data:{matched:result.matched,unknown:result.unknown,duplicates:result.duplicates}});return;}
  const q=enrollmentSchema.safeParse(req.body);if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Provide studentIds or emails');
  if(q.data.emails){const result=await resolveEmails(q.data.emails);await enroll(id.data,result.studentIds);res.json({data:{matched:result.matched,unknown:result.unknown,duplicates:result.duplicates}});return;}
  res.json({data:await enroll(id.data,q.data.studentIds??[])});
}));
router.put('/admin/courses/:id/enrollments',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);const q=teacherSetSchema.safeParse({teacherIds:(req.body as {studentIds?:unknown}).studentIds});if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid student list');const {data}=await adminClient().from('courses').select('id').eq('id',id.data).maybeSingle();if(!data)throw new HttpError(404,'NOT_FOUND','Course not found');res.json({data:await replaceEnrollments(id.data,q.data.teacherIds)})}));
router.delete('/admin/courses/:id/enrollments/:studentId',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const c=z.string().uuid().safeParse(req.params.id);const s=z.string().uuid().safeParse(req.params.studentId);if(!c.success||!s.success)throw new HttpError(404,'NOT_FOUND','Enrollment not found');await unenroll(c.data,s.data);res.json({data:{success:true}})}));
router.get('/admin/courses/:id/people',requireAuth,requireRole('admin'),asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');const {data}=await adminClient().from('courses').select('id').eq('id',id.data).maybeSingle();if(!data)throw new HttpError(404,'NOT_FOUND','Course not found');res.json({data:await coursePeople(id.data)})}));
export default router;

