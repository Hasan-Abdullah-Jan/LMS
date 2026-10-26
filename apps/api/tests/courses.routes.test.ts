import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks=vi.hoisted(()=>({role:'admin' as 'admin'|'teacher'|'student'}));
vi.mock('../src/middleware/auth.js',()=>({
  requireAuth:(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{const h=req.header('authorization');if(!h)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});const role=(h.slice(7)==='student'||h.slice(7)==='teacher'?h.slice(7):'admin') as 'admin'|'teacher'|'student';mocks.role=role;req.user={id:'10000000-0000-4000-8000-000000000001',role,accessToken:h.slice(7),email:'user@example.com',fullName:'Test User',mustChangePassword:false,createdAt:'2026-01-01T00:00:00Z'};next();},
  requireRole:(...roles:string[])=>(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{if(!req.user)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});if(!roles.includes(req.user.role))return res.status(403).json({error:{code:'FORBIDDEN',message:'Forbidden'}});next();},
}));
vi.mock('../src/config/supabase.js',()=>({adminClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'20000000-0000-4000-8000-000000000001'}})})})})}),userClient:()=>({})}));
vi.mock('../src/modules/courses/courses.service.js',()=>({
 listMyCourses:vi.fn(async()=>({data:[],meta:{page:1,pageSize:20,total:0}})),
 getCourse:vi.fn(async()=>({id:'20000000-0000-4000-8000-000000000001',code:'CS101',title:'Foundations',description:null,isArchived:false})),
 listCourses:vi.fn(async(q:{page:number;pageSize:number})=>({data:[],meta:{page:q.page,pageSize:q.pageSize,total:0}})),
 createCourse:vi.fn(async()=>({id:'20000000-0000-4000-8000-000000000001',code:'CS101'})),
 updateCourse:vi.fn(async()=>({id:'20000000-0000-4000-8000-000000000001',code:'CS101'})),
 replaceTeachers:vi.fn(async()=>({courseId:'20000000-0000-4000-8000-000000000001',teacherIds:[]})),
 replaceEnrollments:vi.fn(async()=>({courseId:'20000000-0000-4000-8000-000000000001',enrolled:1})),
 enroll:vi.fn(async()=>({courseId:'20000000-0000-4000-8000-000000000001',enrolled:1})),
 resolveEmails:vi.fn(async()=>({studentIds:[],matched:[],unknown:[],duplicates:[]})),
 unenroll:vi.fn(async()=>undefined),
 coursePeople:vi.fn(async()=>({teachers:[],students:[]})),
}));
vi.mock('../src/modules/resources/resources.service.js',()=>({
 uploadResource:vi.fn(async()=>({id:'30000000-0000-4000-8000-000000000001',title:'Notes'})),
 listResources:vi.fn(async()=>({data:[],meta:{page:1,pageSize:20,total:0}})),
 resourceDownload:vi.fn(async()=>({url:'https://signed.example/secure',expiresIn:60,fileName:'notes.pdf'})),
 deleteResource:vi.fn(async()=>undefined),
}));
import { app } from '../src/app.js';
const admin={Authorization:'Bearer admin'};const teacher={Authorization:'Bearer teacher'};const student={Authorization:'Bearer student'};
const courseId='20000000-0000-4000-8000-000000000001';const resourceId='30000000-0000-4000-8000-000000000001';

describe('Phase 2 course and resource routes',()=>{
 beforeEach(()=>{mocks.role='admin';});
 it('GET /me/courses returns a paginated list',async()=>{const r=await request(app).get('/api/me/courses?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.total).toBe(0)});
 it('GET /me/courses requires a session',async()=>{const r=await request(app).get('/api/me/courses');expect(r.status).toBe(401)});
 it('GET /courses/:id returns course details to a member',async()=>{const r=await request(app).get('/api/courses/'+courseId).set(student);expect(r.status).toBe(200);expect(r.body.data.code).toBe('CS101')});
 it('GET /courses/:id requires a session',async()=>{const r=await request(app).get('/api/courses/'+courseId);expect(r.status).toBe(401)});
 it('GET /admin/courses returns paginated courses to admin',async()=>{const r=await request(app).get('/api/admin/courses').set(admin);expect(r.status).toBe(200);expect(r.body.meta.page).toBe(1)});
 it('GET /admin/courses denies a teacher',async()=>{const r=await request(app).get('/api/admin/courses').set(teacher);expect(r.status).toBe(403)});
 it('POST /admin/courses creates a course',async()=>{const r=await request(app).post('/api/admin/courses').set(admin).send({code:'CS101',title:'Foundations'});expect(r.status).toBe(201)});
 it('POST /admin/courses denies a student',async()=>{const r=await request(app).post('/api/admin/courses').set(student).send({code:'CS101',title:'Foundations'});expect(r.status).toBe(403)});
 it('PATCH /admin/courses/:id archives a course',async()=>{const r=await request(app).patch('/api/admin/courses/'+courseId).set(admin).send({isArchived:true});expect(r.status).toBe(200)});
 it('PATCH /admin/courses/:id denies a teacher',async()=>{const r=await request(app).patch('/api/admin/courses/'+courseId).set(teacher).send({isArchived:true});expect(r.status).toBe(403)});
 it('PUT /admin/courses/:id/teachers replaces course teachers',async()=>{const r=await request(app).put('/api/admin/courses/'+courseId+'/teachers').set(admin).send({teacherIds:[]});expect(r.status).toBe(200)});
 it('PUT /admin/courses/:id/teachers denies a student',async()=>{const r=await request(app).put('/api/admin/courses/'+courseId+'/teachers').set(student).send({teacherIds:[]});expect(r.status).toBe(403)});
 it('POST /admin/courses/:id/enrollments adds students',async()=>{const r=await request(app).post('/api/admin/courses/'+courseId+'/enrollments').set(admin).send({studentIds:[]});expect(r.status).toBe(200)});
 it('POST /admin/courses/:id/enrollments denies a teacher',async()=>{const r=await request(app).post('/api/admin/courses/'+courseId+'/enrollments').set(teacher).send({studentIds:[]});expect(r.status).toBe(403)});
 it('PUT /admin/courses/:id/enrollments replaces student roster',async()=>{const r=await request(app).put('/api/admin/courses/'+courseId+'/enrollments').set(admin).send({studentIds:[]});expect(r.status).toBe(200)});
 it('DELETE /admin/courses/:id/enrollments/:studentId unenrolls a student',async()=>{const r=await request(app).delete('/api/admin/courses/'+courseId+'/enrollments/10000000-0000-4000-8000-000000000002').set(admin);expect(r.status).toBe(200)});
 it('GET /admin/courses/:id/people returns the course roster',async()=>{const r=await request(app).get('/api/admin/courses/'+courseId+'/people').set(admin);expect(r.status).toBe(200)});
 it('GET /admin/courses/:id/people denies a student',async()=>{const r=await request(app).get('/api/admin/courses/'+courseId+'/people').set(student);expect(r.status).toBe(403)});
 it('POST /courses/:id/resources uploads a teacher file',async()=>{const r=await request(app).post('/api/courses/'+courseId+'/resources').set(teacher).field('title','Notes').attach('file',Buffer.from('%PDF-1.4'),{filename:'notes.pdf',contentType:'application/pdf'});expect(r.status).toBe(201)});
 it('POST /courses/:id/resources denies a student',async()=>{const r=await request(app).post('/api/courses/'+courseId+'/resources').set(student).field('title','Notes').attach('file',Buffer.from('%PDF-1.4'),{filename:'notes.pdf',contentType:'application/pdf'});expect(r.status).toBe(403)});
 it('GET /courses/:id/resources returns a paginated member list',async()=>{const r=await request(app).get('/api/courses/'+courseId+'/resources?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.pageSize).toBe(20)});
 it('GET /courses/:id/resources requires a session',async()=>{const r=await request(app).get('/api/courses/'+courseId+'/resources');expect(r.status).toBe(401)});
 it('GET /resources/:id/download returns a short-lived signed URL',async()=>{const r=await request(app).get('/api/resources/'+resourceId+'/download').set(student);expect(r.status).toBe(200);expect(r.body.data.expiresIn).toBe(60)});
 it('DELETE /resources/:id lets a teacher remove a resource',async()=>{const r=await request(app).delete('/api/resources/'+resourceId).set(teacher);expect(r.status).toBe(200)});
 it('DELETE /resources/:id denies a student',async()=>{const r=await request(app).delete('/api/resources/'+resourceId).set(student);expect(r.status).toBe(403)});
});

