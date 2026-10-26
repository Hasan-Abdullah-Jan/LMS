import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
vi.mock('../src/middleware/auth.js',()=>({
 requireAuth:(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{const h=req.header('authorization');if(!h)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});const role=h.slice(7) as 'admin'|'teacher'|'student';req.user={id:'10000000-0000-4000-8000-000000000001',role,accessToken:h.slice(7),email:'user@example.com',fullName:'Test User',mustChangePassword:false,createdAt:'2026-01-01T00:00:00Z'};next();},
 requireRole:(...roles:string[])=>(req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{if(!req.user)return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});if(!roles.includes(req.user.role))return res.status(403).json({error:{code:'FORBIDDEN',message:'Forbidden'}});next();},
}));
vi.mock('../src/modules/learning/learning.service.js',()=>({
 createAssignment:vi.fn(async()=>({id:'30000000-0000-4000-8000-000000000001',title:'Task'})),
 listAssignments:vi.fn(async(_u:unknown,_id:string,page:number,pageSize:number)=>({data:[],meta:{page,pageSize,total:0}})),
 updateAssignment:vi.fn(async()=>({id:'30000000-0000-4000-8000-000000000001'})),
 deleteAssignment:vi.fn(async()=>undefined),
 submitAssignment:vi.fn(async()=>({id:'40000000-0000-4000-8000-000000000001',isLate:false})),
 listSubmissions:vi.fn(async(_u:unknown,_id:string,page:number,pageSize:number)=>({data:[],meta:{page,pageSize,total:0}})),
 gradeSubmission:vi.fn(async()=>({marksObtained:8})),
 createQuiz:vi.fn(async()=>({id:'50000000-0000-4000-8000-000000000001',questionCount:1})),
 listQuizzes:vi.fn(async(_u:unknown,_id:string,page:number,pageSize:number)=>({data:[],meta:{page,pageSize,total:0}})),
 updateQuiz:vi.fn(async()=>({id:'50000000-0000-4000-8000-000000000001'})),
 startAttempt:vi.fn(async()=>({attemptId:'60000000-0000-4000-8000-000000000001',questions:[]})),
 submitAttempt:vi.fn(async()=>({score:1,maxScore:1})),
 quizResults:vi.fn(async(_u:unknown,_id:string,page:number,pageSize:number)=>({data:[],meta:{page,pageSize,total:0}})),
 myMarks:vi.fn(async(_u:unknown,page:number,pageSize:number)=>({data:[],meta:{page,pageSize,total:0}})),
 gradebook:vi.fn(async()=>({students:[],items:[],marks:[]})),
 gradebookCsv:vi.fn(async()=> '\uFEFFStudent,Email\r\n'),
}));
import {app} from '../src/app.js';
const teacher={Authorization:'Bearer teacher'},student={Authorization:'Bearer student'};
const course='20000000-0000-4000-8000-000000000001',assignment='30000000-0000-4000-8000-000000000001',quiz='50000000-0000-4000-8000-000000000001';
const task={title:'Task',instructions:'Do the work',maxMarks:10,dueAt:'2026-12-01T12:00:00.000Z',allowLate:false};
const question={type:'mcq_single',prompt:'2+2?',options:[{id:'a',text:'4'},{id:'b',text:'5'}],correctOptionIds:['a'],marks:1};
describe('Phase 3 assignment, quiz, and marks routes',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('POST /courses/:id/assignments creates a task',async()=>{const r=await request(app).post('/api/courses/'+course+'/assignments').set(teacher).send(task);expect(r.status).toBe(201)});
 it('POST /courses/:id/assignments denies students',async()=>{const r=await request(app).post('/api/courses/'+course+'/assignments').set(student).send(task);expect(r.status).toBe(403)});
 it('GET /courses/:id/assignments returns a paginated list',async()=>{const r=await request(app).get('/api/courses/'+course+'/assignments?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.pageSize).toBe(20)});
 it('PATCH /assignments/:id edits a task',async()=>{const r=await request(app).patch('/api/assignments/'+assignment).set(teacher).send({title:'Updated'});expect(r.status).toBe(200)});
 it('PATCH /assignments/:id denies students',async()=>{const r=await request(app).patch('/api/assignments/'+assignment).set(student).send({title:'Updated'});expect(r.status).toBe(403)});
 it('DELETE /assignments/:id deletes a task',async()=>{const r=await request(app).delete('/api/assignments/'+assignment).set(teacher);expect(r.status).toBe(200)});
 it('PUT /assignments/:id/submission accepts student work',async()=>{const r=await request(app).put('/api/assignments/'+assignment+'/submission').set(student).field('textAnswer','My work');expect(r.status).toBe(200)});
 it('PUT /assignments/:id/submission denies teachers',async()=>{const r=await request(app).put('/api/assignments/'+assignment+'/submission').set(teacher).field('textAnswer','My work');expect(r.status).toBe(403)});
 it('GET /assignments/:id/submissions lists teacher work',async()=>{const r=await request(app).get('/api/assignments/'+assignment+'/submissions?page=1&pageSize=10').set(teacher);expect(r.status).toBe(200)});
 it('GET /assignments/:id/submissions denies students',async()=>{const r=await request(app).get('/api/assignments/'+assignment+'/submissions').set(student);expect(r.status).toBe(403)});
 it('PATCH /submissions/:id/grade saves marks',async()=>{const r=await request(app).patch('/api/submissions/'+assignment+'/grade').set(teacher).send({marks:8,feedback:'Good'});expect(r.status).toBe(200)});
 it('PATCH /submissions/:id/grade denies students',async()=>{const r=await request(app).patch('/api/submissions/'+assignment+'/grade').set(student).send({marks:8});expect(r.status).toBe(403)});
 it('POST /courses/:id/quizzes creates a quiz',async()=>{const r=await request(app).post('/api/courses/'+course+'/quizzes').set(teacher).send({title:'Check-in',timeLimitMinutes:10,opensAt:'2026-11-01T00:00:00.000Z',closesAt:'2026-11-02T00:00:00.000Z',isPublished:true,questions:[question]});expect(r.status).toBe(201)});
 it('POST /courses/:id/quizzes denies students',async()=>{const r=await request(app).post('/api/courses/'+course+'/quizzes').set(student).send({title:'Check-in',timeLimitMinutes:10,opensAt:'2026-11-01T00:00:00.000Z',closesAt:'2026-11-02T00:00:00.000Z',questions:[question]});expect(r.status).toBe(403)});
 it('GET /courses/:id/quizzes returns a paginated list',async()=>{const r=await request(app).get('/api/courses/'+course+'/quizzes?page=1&pageSize=20').set(student);expect(r.status).toBe(200)});
 it('PATCH /quizzes/:id updates a quiz',async()=>{const r=await request(app).patch('/api/quizzes/'+quiz).set(teacher).send({isPublished:true});expect(r.status).toBe(200)});
 it('PATCH /quizzes/:id denies students',async()=>{const r=await request(app).patch('/api/quizzes/'+quiz).set(student).send({isPublished:true});expect(r.status).toBe(403)});
 it('POST /quizzes/:id/attempt starts a student attempt',async()=>{const r=await request(app).post('/api/quizzes/'+quiz+'/attempt').set(student);expect(r.status).toBe(200)});
 it('POST /quizzes/:id/attempt denies teachers',async()=>{const r=await request(app).post('/api/quizzes/'+quiz+'/attempt').set(teacher);expect(r.status).toBe(403)});
 it('POST /quizzes/:id/attempt/submit grades answers',async()=>{const r=await request(app).post('/api/quizzes/'+quiz+'/attempt/submit').set(student).send({answers:{}});expect(r.status).toBe(200)});
 it('GET /quizzes/:id/results returns a paginated teacher list',async()=>{const r=await request(app).get('/api/quizzes/'+quiz+'/results?page=1&pageSize=10').set(teacher);expect(r.status).toBe(200)});
 it('GET /quizzes/:id/results denies students',async()=>{const r=await request(app).get('/api/quizzes/'+quiz+'/results').set(student);expect(r.status).toBe(403)});
 it('GET /me/marks returns only the member marks',async()=>{const r=await request(app).get('/api/me/marks?page=1&pageSize=20').set(student);expect(r.status).toBe(200);expect(r.body.meta.total).toBe(0)});
 it('GET /courses/:id/gradebook returns teacher data',async()=>{const r=await request(app).get('/api/courses/'+course+'/gradebook?page=1&pageSize=50').set(teacher);expect(r.status).toBe(200)});
 it('GET /courses/:id/gradebook.csv returns UTF-8 CSV',async()=>{const r=await request(app).get('/api/courses/'+course+'/gradebook.csv').set(teacher);expect(r.status).toBe(200);expect(r.text.charCodeAt(0)).toBe(65279)});
});

