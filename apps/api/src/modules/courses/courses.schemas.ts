import { z } from 'zod';
export const paginationSchema = z.object({ page:z.coerce.number().int().min(1).default(1), pageSize:z.coerce.number().int().min(1).max(100).default(20), search:z.string().trim().max(120).optional() });
export const courseSchema = z.object({ code:z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/), title:z.string().trim().min(1).max(160), description:z.string().trim().max(3000).optional() });
export const coursePatchSchema = z.object({ code:z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/).optional(), title:z.string().trim().min(1).max(160).optional(), description:z.string().trim().max(3000).nullable().optional(), isArchived:z.boolean().optional() }).refine(v=>Object.keys(v).length>0);
export const teacherSetSchema = z.object({ teacherIds:z.array(z.string().uuid()).max(100) });
export const enrollmentSchema = z.object({ studentIds:z.array(z.string().uuid()).max(500).optional(), emails:z.array(z.string().email()).max(500).optional() }).refine(v=>!!v.studentIds||!!v.emails);
export const resourceMetaSchema = z.object({ title:z.string().trim().min(1).max(160), description:z.string().trim().max(1000).optional() });
export const resourceListSchema = z.object({ page:z.coerce.number().int().min(1).default(1), pageSize:z.coerce.number().int().min(1).max(100).default(20), search:z.string().trim().max(120).optional() });

