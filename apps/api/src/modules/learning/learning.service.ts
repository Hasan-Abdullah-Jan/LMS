import { randomUUID } from 'node:crypto';
import { adminClient, userClient } from '../../config/supabase.js';
import { HttpError } from '../../middleware/errors.js';
import type { UserRole } from '../auth/auth.types.js';

type User={id:string;role:UserRole;accessToken:string};
type Question={type:'mcq_single'|'mcq_multi'|'true_false';prompt:string;options:{id:string;text:string}[];correctOptionIds:string[];marks:number};
const assignmentView=(a:Record<string,unknown>,s?:Record<string,unknown>)=>({id:a.id,courseId:a.course_id,title:a.title,instructions:a.instructions,maxMarks:a.max_marks,dueAt:a.due_at,allowLate:a.allow_late,createdAt:a.created_at,submission:s?{id:s.id,submittedAt:s.submitted_at,isLate:s.is_late,marksObtained:s.marks_obtained,feedback:s.feedback,gradedAt:s.graded_at}:null});
async function teach(client:ReturnType<typeof userClient>,courseId:string,role:UserRole){
 if(role==='admin')return;const {data}=await client.from('course_teachers').select('course_id').eq('course_id',courseId).maybeSingle();
 if(!data)throw new HttpError(403,'FORBIDDEN','You do not teach this course');
}
export async function createAssignment(u:User,cid:string,v:{title:string;instructions:string;maxMarks:number;dueAt:string;allowLate:boolean}){
 const c=userClient(u.accessToken);await teach(c,cid,u.role);
 const {data,error}=await c.from('assignments').insert({course_id:cid,created_by:u.id,title:v.title,instructions:v.instructions,max_marks:v.maxMarks,due_at:v.dueAt,allow_late:v.allowLate}).select('*').single();
 if(error||!data)throw new HttpError(422,'ASSIGNMENT_CREATE_FAILED','Could not create assignment');return assignmentView(data);
}
export async function listAssignments(u:User,cid:string,page:number,pageSize:number){
 const from=(page-1)*pageSize;const {data,error,count}=await userClient(u.accessToken).from('assignments').select('*,submissions(id,student_id,submitted_at,is_late,marks_obtained,feedback,graded_at)',{count:'exact'}).eq('course_id',cid).order('due_at').range(from,from+pageSize-1);
 if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load assignments');
 return {data:(data??[]).map((a:Record<string,unknown>)=>{const ss=(a.submissions??[]) as Record<string,unknown>[];return {...assignmentView(a,u.role==='student'?ss.find(s=>s.student_id===u.id):undefined),submissionCount:ss.length};}),meta:{page,pageSize,total:count??0}};
}
export async function updateAssignment(u:User,id:string,v:Record<string,unknown>){
 const c=userClient(u.accessToken);const {data}=await c.from('assignments').select('course_id').eq('id',id).maybeSingle();if(!data)throw new HttpError(404,'NOT_FOUND','Assignment not found');await teach(c,String(data.course_id),u.role);
 const p:Record<string,unknown>={};const fields:Array<[string,string]>=[['title','title'],['instructions','instructions'],['maxMarks','max_marks'],['dueAt','due_at'],['allowLate','allow_late']];for(const [a,b] of fields)if(v[a]!==undefined)p[b]=v[a];
 const {data:row,error}=await c.from('assignments').update(p).eq('id',id).select('*').maybeSingle();if(error)throw new HttpError(422,'UPDATE_FAILED','Could not update assignment');if(!row)throw new HttpError(404,'NOT_FOUND','Assignment not found');return assignmentView(row);
}
export async function deleteAssignment(u:User,id:string){
 const c=userClient(u.accessToken);const {data}=await c.from('assignments').select('course_id').eq('id',id).maybeSingle();if(!data)throw new HttpError(404,'NOT_FOUND','Assignment not found');await teach(c,String(data.course_id),u.role);const {error}=await c.from('assignments').delete().eq('id',id);if(error)throw new HttpError(500,'DELETE_FAILED','Could not delete assignment');
}
export async function submitAssignment(u:User,id:string,text:string|undefined,file?:Express.Multer.File){
 const c=userClient(u.accessToken);const {data:a}=await c.from('assignments').select('*').eq('id',id).maybeSingle();if(!a)throw new HttpError(404,'NOT_FOUND','Assignment not found');
 const late=Date.now()>new Date(a.due_at).getTime();if(late&&!a.allow_late)throw new HttpError(409,'LATE_SUBMISSION','The submission deadline has passed');if(!text?.trim()&&!file)throw new HttpError(422,'SUBMISSION_EMPTY','Add a written answer or attach a file');
 let path:string|undefined;
 if(file){const {allowedFile}=await import('../resources/resources.service.js');if(!allowedFile(file))throw new HttpError(422,'FILE_TYPE_NOT_ALLOWED','Choose a PDF, DOCX, PPTX, image, or ZIP file');path=id+'/'+u.id+'/'+randomUUID()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);const {error}=await c.storage.from('submissions').upload(path,file.buffer,{contentType:file.mimetype});if(error)throw new HttpError(422,'UPLOAD_FAILED','Could not upload submission file');}
 const {data:old}=await c.from('submissions').select('file_path').eq('assignment_id',id).eq('student_id',u.id).maybeSingle();
 const {data:row,error}=await c.from('submissions').upsert({assignment_id:id,student_id:u.id,text_answer:text?.trim()||null,file_path:path??old?.file_path??null,submitted_at:new Date().toISOString(),is_late:late,marks_obtained:null,feedback:null,graded_by:null,graded_at:null},{onConflict:'assignment_id,student_id'}).select('*').single();
 if(error||!row){if(path)await c.storage.from('submissions').remove([path]);throw new HttpError(422,'SUBMISSION_FAILED','Could not save submission');}
 if(path&&old?.file_path)await c.storage.from('submissions').remove([old.file_path]);
 return {id:row.id,submittedAt:row.submitted_at,isLate:row.is_late};
}
export async function listSubmissions(u:User,id:string,page:number,pageSize:number){
 const c=userClient(u.accessToken);const {data:a}=await c.from('assignments').select('course_id').eq('id',id).maybeSingle();if(!a)throw new HttpError(404,'NOT_FOUND','Assignment not found');await teach(c,String(a.course_id),u.role);
 const from=(page-1)*pageSize;const {data,error,count}=await c.from('submissions').select('*,profiles(full_name,email)',{count:'exact'}).eq('assignment_id',id).order('submitted_at').range(from,from+pageSize-1);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load submissions');
 const rows=await Promise.all((data??[]).map(async(row)=>{let downloadUrl:string|undefined;if(row.file_path){const {data:signed}=await c.storage.from('submissions').createSignedUrl(row.file_path,60);downloadUrl=signed?.signedUrl;}return {...row,downloadUrl};}));
 return {data:rows.map(s=>({id:s.id,assignmentId:s.assignment_id,studentId:s.student_id,student:s.profiles?{fullName:(s.profiles as {full_name:string}).full_name,email:(s.profiles as {email:string}).email}:null,textAnswer:s.text_answer,submittedAt:s.submitted_at,isLate:s.is_late,marksObtained:s.marks_obtained,feedback:s.feedback,gradedAt:s.graded_at,downloadUrl:s.downloadUrl})),meta:{page,pageSize,total:count??0}};
}
export async function gradeSubmission(u:User,id:string,marks:number,feedback?:string){
 const c=userClient(u.accessToken);const {data:s}=await c.from('submissions').select('assignment_id').eq('id',id).maybeSingle();if(!s)throw new HttpError(404,'NOT_FOUND','Submission not found');
 const {data:a}=await c.from('assignments').select('course_id,max_marks').eq('id',s.assignment_id).maybeSingle();if(!a)throw new HttpError(404,'NOT_FOUND','Submission not found');await teach(c,String(a.course_id),u.role);
 if(marks>Number(a.max_marks))throw new HttpError(422,'MARKS_EXCEED_MAX','Marks cannot exceed the assignment maximum');
 const {data,error}=await c.from('submissions').update({marks_obtained:marks,feedback:feedback??null,graded_by:u.id,graded_at:new Date().toISOString()}).eq('id',id).select('*').single();if(error||!data)throw new HttpError(422,'GRADE_FAILED','Could not save grade');
 await adminClient().from('audit_log').insert({actor_id:u.id,action:'submission.graded',entity:'submission',entity_id:id});return data;
}
async function questionsInsert(c:ReturnType<typeof userClient>,qid:string,qs:Question[]){
 const {data,error}=await c.from('quiz_questions').insert(qs.map((q,i)=>({quiz_id:qid,position:i+1,type:q.type,prompt:q.prompt,options:q.options,marks:q.marks}))).select('id');
 if(error||!data)throw new HttpError(422,'QUESTION_CREATE_FAILED','Could not save quiz questions');
 const {error:keyError}=await c.from('quiz_answers').insert(data.map((x,i)=>({question_id:x.id,correct_option_ids:qs[i]!.correctOptionIds})));if(keyError)throw new HttpError(422,'ANSWER_CREATE_FAILED','Could not save quiz answer keys');
}
export async function createQuiz(u:User,cid:string,v:{title:string;description?:string|undefined;timeLimitMinutes:number;opensAt:string;closesAt:string;isPublished:boolean;questions:Question[]}){
 const c=userClient(u.accessToken);await teach(c,cid,u.role);const {data,error}=await c.from('quizzes').insert({course_id:cid,created_by:u.id,title:v.title,description:v.description??null,time_limit_minutes:v.timeLimitMinutes,opens_at:v.opensAt,closes_at:v.closesAt,is_published:v.isPublished}).select('id').single();
 if(error||!data)throw new HttpError(422,'QUIZ_CREATE_FAILED','Could not create quiz');try{await questionsInsert(c,data.id,v.questions)}catch(e){await c.from('quizzes').delete().eq('id',data.id);throw e;}return {id:data.id,title:v.title,questionCount:v.questions.length};
}
export async function listQuizzes(u:User,cid:string,page:number,pageSize:number){
 const from=(page-1)*pageSize;const {data,error,count}=await userClient(u.accessToken).from('quizzes').select('*,quiz_questions(id,position,type,prompt,options,marks),quiz_attempts(id,student_id,submitted_at,score)',{count:'exact'}).eq('course_id',cid).order('opens_at').range(from,from+pageSize-1);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load quizzes');
 return {data:(data??[]).map((q:Record<string,unknown>)=>{const attempts=(q.quiz_attempts??[]) as Record<string,unknown>[];const own=attempts.find(a=>a.student_id===u.id);return {id:q.id,courseId:q.course_id,title:q.title,description:q.description,timeLimitMinutes:q.time_limit_minutes,opensAt:q.opens_at,closesAt:q.closes_at,isPublished:q.is_published,questions:q.quiz_questions,hasAttempt:!!own,submittedAt:own?.submitted_at??null,score:own?.score??null};}),meta:{page,pageSize,total:count??0}};
}
export async function updateQuiz(u:User,id:string,v:Record<string,unknown>){
 const c=userClient(u.accessToken);const {data:q}=await c.from('quizzes').select('course_id').eq('id',id).maybeSingle();if(!q)throw new HttpError(404,'NOT_FOUND','Quiz not found');await teach(c,String(q.course_id),u.role);
 const {count}=await c.from('quiz_attempts').select('id',{count:'exact',head:true}).eq('quiz_id',id);if((count??0)>0)throw new HttpError(409,'QUIZ_HAS_ATTEMPTS','A quiz cannot be edited after an attempt has started');
 const p:Record<string,unknown>={};const fields:Array<[string,string]>=[['title','title'],['description','description'],['timeLimitMinutes','time_limit_minutes'],['opensAt','opens_at'],['closesAt','closes_at'],['isPublished','is_published']];for(const [a,b] of fields)if(v[a]!==undefined)p[b]=v[a];
 if(v.questions)await c.from('quiz_questions').delete().eq('quiz_id',id);
 const {error}=await c.from('quizzes').update(p).eq('id',id);if(error)throw new HttpError(422,'QUIZ_UPDATE_FAILED','Could not update quiz');if(v.questions)await questionsInsert(c,id,v.questions as Question[]);return {id};
}
export async function startAttempt(u:User,id:string){
 const c=userClient(u.accessToken);const {data:q}=await c.from('quizzes').select('id,title,course_id,time_limit_minutes,opens_at,closes_at,is_published').eq('id',id).maybeSingle();if(!q)throw new HttpError(404,'NOT_FOUND','Quiz not found');if(u.role!=='student')throw new HttpError(403,'FORBIDDEN','Students only');
 const now=Date.now();if(!q.is_published||now<new Date(q.opens_at).getTime()||now>new Date(q.closes_at).getTime())throw new HttpError(409,'QUIZ_CLOSED','This quiz is not open');
 const {data:attempt,error}=await c.from('quiz_attempts').insert({quiz_id:id,student_id:u.id}).select('id,started_at').single();if(error||!attempt)throw new HttpError(409,'ATTEMPT_EXISTS','You have already started this quiz');
 const {data:qs,error:qError}=await c.from('quiz_questions').select('id,position,type,prompt,options,marks').eq('quiz_id',id).order('position');if(qError)throw new HttpError(500,'DATABASE_ERROR','Could not load quiz questions');
 return {attemptId:attempt.id,startedAt:attempt.started_at,expiresAt:new Date(new Date(attempt.started_at).getTime()+Number(q.time_limit_minutes)*60000).toISOString(),timeLimitMinutes:q.time_limit_minutes,title:q.title,questions:qs??[]};
}
export async function submitAttempt(u:User,id:string,answers:Record<string,string[]>){
 if(u.role!=='student')throw new HttpError(403,'FORBIDDEN','Students only');const c=userClient(u.accessToken);const {data:a}=await c.from('quiz_attempts').select('id,started_at,submitted_at').eq('quiz_id',id).eq('student_id',u.id).maybeSingle();if(!a)throw new HttpError(404,'NOT_FOUND','Attempt not found');if(a.submitted_at)throw new HttpError(409,'ALREADY_SUBMITTED','This quiz attempt has already been submitted');
 const {data:q}=await c.from('quizzes').select('time_limit_minutes').eq('id',id).maybeSingle();if(!q)throw new HttpError(404,'NOT_FOUND','Quiz not found');if(Date.now()>new Date(a.started_at).getTime()+Number(q.time_limit_minutes)*60000+10000)throw new HttpError(409,'QUIZ_EXPIRED','The quiz submission window has expired');
 const {data:qs,error}=await c.from('quiz_questions').select('id,options,marks').eq('quiz_id',id);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not grade quiz');const ids=new Set((qs??[]).map(x=>String(x.id)));if(Object.keys(answers).some(k=>!ids.has(k)))throw new HttpError(422,'INVALID_ANSWERS','Unknown question in submission');
 const {data:keys,error:keyError}=await adminClient().from('quiz_answers').select('question_id,correct_option_ids').in('question_id',[...ids]);if(keyError)throw new HttpError(500,'GRADING_FAILED','Could not grade quiz');const keyMap=new Map((keys??[]).map(k=>[String(k.question_id),k.correct_option_ids as string[]]));let score=0;
 for(const x of qs??[]){const expected=keyMap.get(String(x.id))??[];const selected=answers[String(x.id)]??[];const valid=new Set((x.options as {id:string}[]).map(o=>o.id));if(selected.some(s=>!valid.has(s)))throw new HttpError(422,'INVALID_ANSWERS','Unknown answer option');const a=[...expected].sort(),b=[...selected].sort();if(a.length===b.length&&a.every((v,i)=>v===b[i]))score+=Number(x.marks);}
 const {error:updateError}=await adminClient().from('quiz_attempts').update({answers,score,submitted_at:new Date().toISOString()}).eq('id',a.id).eq('student_id',u.id);if(updateError)throw new HttpError(422,'SUBMISSION_FAILED','Could not submit quiz');return {quizId:id,attemptId:a.id,score,maxScore:(qs??[]).reduce((sum,x)=>sum+Number(x.marks),0)};
}
export async function quizResults(u:User,id:string,page:number,pageSize:number){
 const c=userClient(u.accessToken);const {data:q}=await c.from('quizzes').select('course_id').eq('id',id).maybeSingle();if(!q)throw new HttpError(404,'NOT_FOUND','Quiz not found');await teach(c,String(q.course_id),u.role);const from=(page-1)*pageSize;const {data,error,count}=await c.from('quiz_attempts').select('id,student_id,started_at,submitted_at,score,profiles(full_name,email)',{count:'exact'}).eq('quiz_id',id).order('started_at').range(from,from+pageSize-1);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load quiz results');return {data:(data??[]).map(a=>({id:a.id,studentId:a.student_id,student:a.profiles,startedAt:a.started_at,submittedAt:a.submitted_at,score:a.score})),meta:{page,pageSize,total:count??0}};
}
export async function myMarks(u:User,page:number,pageSize:number,cid?:string){
 let q=userClient(u.accessToken).from('v_student_marks').select('*',{count:'exact'}).eq('student_id',u.id).order('graded_at',{ascending:false});if(cid)q=q.eq('course_id',cid);const from=(page-1)*pageSize;const {data,error,count}=await q.range(from,from+pageSize-1);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load marks');return {data:(data??[]).map(m=>({studentId:m.student_id,courseId:m.course_id,kind:m.kind,itemId:m.item_id,title:m.title,obtained:m.obtained,max:m.max,gradedAt:m.graded_at})),meta:{page,pageSize,total:count??0}};
}
export async function gradebook(u:User,cid:string,page=1,pageSize=100){
 const c=userClient(u.accessToken);await teach(c,cid,u.role);
 const from=(page-1)*pageSize;const [{data:es,error:e,count},{data:as,error:a},{data:qs,error:q},{data:ms,error:m}]=await Promise.all([c.from('enrollments').select('student_id,profiles(id,full_name,email)',{count:'exact'}).eq('course_id',cid).range(from,from+pageSize-1),c.from('assignments').select('id,title,max_marks').eq('course_id',cid),c.from('quizzes').select('id,title').eq('course_id',cid),c.from('v_student_marks').select('*').eq('course_id',cid)]);
 if(e||a||q||m)throw new HttpError(500,'DATABASE_ERROR','Could not load gradebook');
 const students=(es??[]).flatMap(x=>{const p=Array.isArray(x.profiles)?x.profiles[0]:x.profiles;return p?[{id:x.student_id,fullName:(p as {full_name:string}).full_name,email:(p as {email:string}).email}]:[]});
 const items=[...(as??[]).map(x=>({id:x.id,title:x.title,kind:'assignment',max:Number(x.max_marks)})),...(qs??[]).map(x=>({id:x.id,title:x.title,kind:'quiz',max:null as number|null}))];
 const marks=(ms??[]).map(x=>({studentId:x.student_id,itemId:x.item_id,kind:x.kind,obtained:x.obtained,max:x.max,gradedAt:x.graded_at}));return {students,items,marks,meta:{page,pageSize,total:count??0}};
}
export async function gradebookCsv(u:User,cid:string){
 const b=await gradebook(u,cid,1,5000);const esc=(v:unknown)=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};const rows=[['Student','Email',...b.items.map(x=>x.title+' ('+x.kind+')'),'Total obtained','Total possible','Percentage'].map(esc).join(',')];
 for(const s of b.students){const userMarks=b.marks.filter(x=>x.studentId===s.id);const vals=b.items.map(i=>{const m=userMarks.find(x=>x.itemId===i.id);return m?.obtained??''});const got=userMarks.reduce((n,m)=>n+Number(m.obtained??0),0);const max=userMarks.reduce((n,m)=>n+Number(m.max??0),0);rows.push([s.fullName,s.email,...vals,got,max,max?((got/max)*100).toFixed(2)+'%':''].map(esc).join(','));}
 return '\uFEFF'+rows.join('\r\n');
}

