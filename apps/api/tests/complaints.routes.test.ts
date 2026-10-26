import { beforeEach,describe,expect,it,vi } from 'vitest';
import request from 'supertest';
vi.mock('../src/middleware/auth.js',()=>({
 requireAuth:(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{const h=req.header('authorization');if(!h)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});const role=h.slice(7) as 'admin'|'teacher'|'student';req.user={id:'10000000-0000-4000-8000-000000000001',role,accessToken:h.slice(7),email:'user@example.com',fullName:'Test User',mustChangePassword:false,createdAt:'2026-01-01T00:00:00Z'};next();},
 requireRole:(...roles:string[])=>(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{if(!req.user)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});if(!roles.includes(req.user.role))return res.status(403).json({error:{code:'FORBIDDEN',message:'Forbidden'}});next();},
}));
vi.mock('../src/modules/complaints/complaints.service.js',()=>({
 createComplaint:vi.fn(async()=>({id:'70000000-0000-4000-8000-000000000001',status:'open'})),listMine:vi.fn(async()=>({data:[],meta:{page:1,pageSize:20,total:0}})),listAdmin:vi.fn(async()=>({data:[],meta:{page:1,pageSize:20,total:0}})),updateComplaint:vi.fn(async()=>({id:'70000000-0000-4000-8000-000000000001',status:'in_review'})),complaintAttachment:vi.fn(async()=>({url:'https://signed.test',expiresIn:60})),unreadComplaintCount:vi.fn(async()=>2),markComplaintRead:vi.fn(async()=>({success:true})),
}));
import {app} from '../src/app.js';
const student={Authorization:'Bearer student'},admin={Authorization:'Bearer admin'};const id='70000000-0000-4000-8000-000000000001';
describe('complaint routes',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('accepts valid private complaint submissions',async()=>{const r=await request(app).post('/api/complaints').set(student).field('category','academic').field('subject','Course access issue').field('description','I cannot access the material for this week.');expect(r.status).toBe(201);});
 it('requires authentication to submit',async()=>{const r=await request(app).post('/api/complaints').send({category:'academic',subject:'Issue',description:'A sufficiently long issue'});expect(r.status).toBe(401)});
 it('lists the signed-in reporter complaints',async()=>{const r=await request(app).get('/api/complaints/mine?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.total).toBe(0)});
 it('does not expose the reporter list to admins through the user endpoint',async()=>{const r=await request(app).get('/api/complaints/mine').set(admin);expect(r.status).toBe(403)});
 it('returns an unread status update count',async()=>{const r=await request(app).get('/api/complaints/unread-count').set(student);expect(r.body.data.unreadCount).toBe(2)});
 it('marks a complaint update read',async()=>{const r=await request(app).post('/api/complaints/read').set(student).send({complaintId:id});expect(r.status).toBe(200)});
 it('provides a short lived attachment URL',async()=>{const r=await request(app).get(`/api/complaints/${id}/attachment`).set(student);expect(r.body.data.expiresIn).toBe(60)});
 it('lets admins filter the complaint queue',async()=>{const r=await request(app).get('/api/admin/complaints?status=open&page=1&pageSize=20').set(admin);expect(r.status).toBe(200)});
 it('denies students access to the admin queue',async()=>{const r=await request(app).get('/api/admin/complaints').set(student);expect(r.status).toBe(403)});
 it('lets admins transition complaints with a response',async()=>{const r=await request(app).patch(`/api/admin/complaints/${id}`).set(admin).send({status:'in_review'});expect(r.status).toBe(200)});
 it('requires a response for a closed complaint',async()=>{const r=await request(app).patch(`/api/admin/complaints/${id}`).set(admin).send({status:'resolved'});expect(r.status).toBe(422)});
});
