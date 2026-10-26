import {z} from 'zod';
export const announcementSchema=z.object({courseId:z.string().uuid().nullable().optional(),title:z.string().trim().min(1).max(180),body:z.string().trim().min(1).max(10000),isPinned:z.boolean().default(false)});
export const announcementPatchSchema=z.object({title:z.string().trim().min(1).max(180).optional(),body:z.string().trim().min(1).max(10000).optional(),isPinned:z.boolean().optional()}).refine(v=>Object.keys(v).length>0);
export const announcementListSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),courseId:z.string().uuid().optional()});
export const readSchema=z.object({upTo:z.string().datetime()});
export const messageSchema=z.object({body:z.string().trim().min(1).max(2000)});
export const messageQuerySchema=z.object({before:z.string().datetime().optional(),limit:z.coerce.number().int().min(1).max(50).default(50)});

