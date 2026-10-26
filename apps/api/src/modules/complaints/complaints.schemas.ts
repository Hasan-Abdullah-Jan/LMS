import { z } from 'zod';
export const complaintCreateSchema=z.object({courseId:z.string().uuid().optional(),category:z.enum(['academic','technical','account','facilities','other']),subject:z.string().trim().min(4).max(180),description:z.string().trim().min(10).max(10000)});
export const complaintPageSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20)});
export const complaintAdminQuerySchema=complaintPageSchema.extend({status:z.enum(['open','in_review','resolved','rejected']).optional(),category:z.enum(['academic','technical','account','facilities','other']).optional()});
export const complaintUpdateSchema=z.object({status:z.enum(['in_review','resolved','rejected']),response:z.string().trim().max(5000).optional()}).refine(v=>!['resolved','rejected'].includes(v.status)||!!v.response,{message:'A response is required to resolve or reject a complaint'});
export const complaintReadSchema=z.object({complaintId:z.string().uuid()});
