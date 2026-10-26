import { beforeEach,describe,expect,it,vi } from 'vitest';
import request from 'supertest';
vi.mock('../src/middleware/auth.js',()=>({
 requireAuth:(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{const h=req.header('authorization');if(!h)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});const role=h.slice(7) as 'admin'|'teacher'|'student';req.user={id:'10000000-0000-4000-8000-000000000001',role,accessToken:h.slice(7),email:'user@example.com',fullName:'Test User',mustChangePassword:false,createdAt:'2026-01-01T00:00:00Z'};next();},
 requireRole:(...roles:string[])=>(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{if(!req.user)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});if(!roles.includes(req.user.role))return res.status(403).json({error:{code:'FORBIDDEN',message:'Forbidden'}});next();},
}));
vi.mock('../src/modules/communication/communication.service.js',()=>({
 createAnnouncement:vi.fn(async()=>({id:'80000000-0000-4000-8000-000000000001',title:'Update'})),listAnnouncements:vi.fn(async()=>({data:[],meta:{page:1,pageSize:20,total:0,unreadCount:0}})),markAnnouncementsRead:vi.fn(async()=>({updated:1})),updateAnnouncement:vi.fn(async()=>({id:'80000000-0000-4000-8000-000000000001'})),deleteAnnouncement:vi.fn(async()=>undefined),listMessages:vi.fn(async()=>({data:[],meta:{limit:50,nextBefore:null}})),sendMessage:vi.fn(async()=>({id:'90000000-0000-4000-8000-000000000001',body:'Hello'})),deleteMessage:vi.fn(async()=>undefined),
}));
import {app} from '../src/app.js';
const teacher={Authorization:'Bearer teacher'},student={Authorization:'Bearer student'},admin={Authorization:'Bearer admin'};const course='20000000-0000-4000-8000-000000000001',announcement='80000000-0000-4000-8000-000000000001',message='90000000-0000-4000-8000-000000000001';
describe('announcement and classroom chat routes',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('creates course announcements for teachers',async()=>{const r=await request(app).post('/api/announcements').set(teacher).send({courseId:course,title:'Schedule',body:'Updated class schedule',isPinned:false});expect(r.status).toBe(201)});
 it('denies students from posting announcements',async()=>{const r=await request(app).post('/api/announcements').set(student).send({title:'Schedule',body:'Updated schedule'});expect(r.status).toBe(403)});
 it('lists announcements for signed-in users',async()=>{const r=await request(app).get('/api/announcements?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.unreadCount).toBe(0)});
 it('records announcement reads',async()=>{const r=await request(app).post('/api/announcements/read').set(student).send({upTo:'2026-10-26T12:00:00.000Z'});expect(r.status).toBe(200)});
 it('updates announcements for staff',async()=>{const r=await request(app).patch(`/api/announcements/${announcement}`).set(admin).send({title:'New headline'});expect(r.status).toBe(200)});
 it('lists course chat messages',async()=>{const r=await request(app).get(`/api/courses/${course}/messages`).set(student);expect(r.status).toBe(200)});
 it('sends course chat messages',async()=>{const r=await request(app).post(`/api/courses/${course}/messages`).set(student).send({body:'Hello everyone'});expect(r.status).toBe(201)});
 it('rejects blank chat messages',async()=>{const r=await request(app).post(`/api/courses/${course}/messages`).set(student).send({body:'  '});expect(r.status).toBe(422)});
 it('soft deletes chat messages',async()=>{const r=await request(app).delete(`/api/messages/${message}`).set(student);expect(r.status).toBe(200)});
 it('requires authentication for announcements',async()=>{const r=await request(app).get('/api/announcements');expect(r.status).toBe(401)});
});
