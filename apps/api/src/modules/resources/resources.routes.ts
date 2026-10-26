import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/errors.js';
import { deleteResource, listResources, resourceDownload, uploadResource } from './resources.service.js';
import { resourceListSchema, resourceMetaSchema } from '../courses/courses.schemas.js';

const router=Router();const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024}});
router.post('/courses/:id/resources',requireAuth,requireRole('teacher','admin'),upload.single('file'),asyncHandler(async(req,res)=>{
  const id=z.string().uuid().safeParse(req.params.id);const meta=resourceMetaSchema.safeParse(req.body);
  if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');if(!meta.success)throw new HttpError(422,'VALIDATION_ERROR','Provide a title and valid description');
  if(!req.file)throw new HttpError(422,'FILE_REQUIRED','Choose a file to upload');
  res.status(201).json({data:await uploadResource({id:req.user!.id,role:req.user!.role,accessToken:req.user!.accessToken},id.data,req.file,meta.data.title,meta.data.description)});
}));
router.get('/courses/:id/resources',requireAuth,asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);const q=resourceListSchema.safeParse(req.query);if(!id.success)throw new HttpError(404,'NOT_FOUND','Course not found');if(!q.success)throw new HttpError(422,'VALIDATION_ERROR','Invalid pagination');res.json(await listResources({id:req.user!.id,role:req.user!.role,accessToken:req.user!.accessToken},id.data,q.data))}));
router.get('/resources/:id/download',requireAuth,asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success)throw new HttpError(404,'NOT_FOUND','Resource not found');res.json({data:await resourceDownload({id:req.user!.id,role:req.user!.role,accessToken:req.user!.accessToken},id.data)})}));
router.delete('/resources/:id',requireAuth,requireRole('teacher','admin'),asyncHandler(async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success)throw new HttpError(404,'NOT_FOUND','Resource not found');await deleteResource({id:req.user!.id,role:req.user!.role,accessToken:req.user!.accessToken},id.data);res.json({data:{success:true}})}));
export default router;

