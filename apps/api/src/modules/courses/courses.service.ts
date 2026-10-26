import { adminClient, userClient } from '../../config/supabase.js';
import { HttpError } from '../../middleware/errors.js';
import type { UserRole } from '../auth/auth.types.js';

const mapCourse=(c:Record<string,unknown>)=>({id:c.id,code:c.code,title:c.title,description:c.description,isArchived:c.is_archived,createdAt:c.created_at,updatedAt:c.updated_at});
const profileName=(p:Record<string,unknown>)=>({id:p.id,fullName:p.full_name,email:p.email,role:p.role,rollNo:p.roll_no});

export async function listMyCourses(profile:{id:string;role:UserRole}, accessToken:string, page:number, pageSize:number) {
  const client=userClient(accessToken);
  if(profile.role==='admin') {
    const from=(page-1)*pageSize;const {data,error,count}=await client.from('courses').select('*',{count:'exact'}).order('title').range(from,from+pageSize-1);
    if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load courses');
    return {data:(data??[]).map(mapCourse),meta:{page,pageSize,total:count??0}};
  }
  const table=profile.role==='teacher'?'course_teachers':'enrollments';
  const key=profile.role==='teacher'?'teacher_id':'student_id';
  const from=(page-1)*pageSize;const {data,error,count}=await client.from(table).select('courses(*)',{count:'exact'}).eq(key,profile.id).range(from,from+pageSize-1);
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load courses');
  return {data:(data??[]).flatMap((row:Record<string,unknown>)=>row.courses?[mapCourse(row.courses as Record<string,unknown>)]:[]),meta:{page,pageSize,total:count??0}};
}
export async function getCourse(id:string,accessToken:string) {
  const {data,error}=await userClient(accessToken).from('courses').select('*').eq('id',id).maybeSingle();
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load course');
  if(!data)throw new HttpError(404,'NOT_FOUND','Course not found');
  return mapCourse(data);
}

export async function listCourses(query:{page:number;pageSize:number;search?:string|undefined}) {
  let q=adminClient().from('courses').select('*',{count:'exact'}).order('created_at',{ascending:false});
  if(query.search)q=q.or(`code.ilike.%${query.search.replace(/[,%()]/g,'')}%,title.ilike.%${query.search.replace(/[,%()]/g,'')}%`);
  const from=(query.page-1)*query.pageSize;
  const {data,error,count}=await q.range(from,from+query.pageSize-1);
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load courses');
  return {data:(data??[]).map(mapCourse),meta:{page:query.page,pageSize:query.pageSize,total:count??0}};
}
export async function createCourse(input:{code:string;title:string;description?:string|undefined}) {
  const row={code:input.code.toUpperCase(),title:input.title,description:input.description??null};
  const {data,error}=await adminClient().from('courses').insert(row).select('*').single();
  if(error)throw new HttpError(409,'COURSE_CREATE_FAILED','Course code already exists or the course could not be created');
  return mapCourse(data);
}
export async function updateCourse(id:string,input:{code?:string|undefined;title?:string|undefined;description?:string|null|undefined;isArchived?:boolean|undefined}) {
  const update:Record<string,unknown>={};
  if(input.code!==undefined)update.code=input.code.toUpperCase();
  if(input.title!==undefined)update.title=input.title;
  if(input.description!==undefined)update.description=input.description;
  if(input.isArchived!==undefined)update.is_archived=input.isArchived;
  const {data,error}=await adminClient().from('courses').update(update).eq('id',id).select('*').maybeSingle();
  if(error)throw new HttpError(422,'COURSE_UPDATE_FAILED','Could not update course');
  if(!data)throw new HttpError(404,'NOT_FOUND','Course not found');
  return mapCourse(data);
}
export async function replaceTeachers(courseId:string,teacherIds:string[]) {
  const admin=adminClient();
  if(teacherIds.length) {
    const {data,error}=await admin.from('profiles').select('id').eq('role','teacher').eq('is_active',true).in('id',teacherIds);
    if(error||data?.length!==new Set(teacherIds).size)throw new HttpError(422,'INVALID_TEACHERS','Select active teacher accounts only');
  }
  const {error:deleteError}=await admin.from('course_teachers').delete().eq('course_id',courseId);
  if(deleteError)throw new HttpError(500,'DATABASE_ERROR','Could not update course teachers');
  if(teacherIds.length) {
    const {error}=await admin.from('course_teachers').insert([...new Set(teacherIds)].map(teacherId=>({course_id:courseId,teacher_id:teacherId})));
    if(error)throw new HttpError(422,'ASSIGNMENT_FAILED','Could not assign teachers');
  }
  return {courseId,teacherIds:[...new Set(teacherIds)]};
}
export async function listCoursePeople(courseId:string) {
  const admin=adminClient();
  const [{data:teachers,error:te},{data:students,error:se}]=await Promise.all([
    admin.from('course_teachers').select('profiles(id,full_name,email,role,roll_no)').eq('course_id',courseId),
    admin.from('enrollments').select('profiles(id,full_name,email,role,roll_no)').eq('course_id',courseId),
  ]);
  if(te||se)throw new HttpError(500,'DATABASE_ERROR','Could not load course members');
  return {teachers:(teachers??[]).flatMap(r=>r.profiles?[profileName((Array.isArray(r.profiles)?r.profiles[0]:r.profiles) as unknown as Record<string,unknown>)]:[]),students:(students??[]).flatMap(r=>r.profiles?[profileName((Array.isArray(r.profiles)?r.profiles[0]:r.profiles) as unknown as Record<string,unknown>)]:[])};
}
export async function enroll(courseId:string,studentIds:string[]) {
  const admin=adminClient();const ids=[...new Set(studentIds)];
  if(ids.length) {
    const {data,error}=await admin.from('profiles').select('id').eq('role','student').eq('is_active',true).in('id',ids);
    if(error||data?.length!==ids.length)throw new HttpError(422,'INVALID_STUDENTS','Select active student accounts only');
    const {error:insertError}=await admin.from('enrollments').upsert(ids.map(student_id=>({course_id:courseId,student_id})),{onConflict:'course_id,student_id',ignoreDuplicates:true});
    if(insertError)throw new HttpError(422,'ENROLLMENT_FAILED','Could not enroll students');
  }
  return {courseId,enrolled:ids.length};
}
export async function replaceEnrollments(courseId:string,studentIds:string[]) {
  const admin=adminClient();const ids=[...new Set(studentIds)];
  if(ids.length) {
    const {data,error}=await admin.from('profiles').select('id').eq('role','student').eq('is_active',true).in('id',ids);
    if(error||data?.length!==ids.length)throw new HttpError(422,'INVALID_STUDENTS','Select active student accounts only');
  }
  if(ids.length){const {error}=await admin.from('enrollments').delete().eq('course_id',courseId).not('student_id','in',`(${ids.join(',')})`);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not update course roster');}
  else {const {error}=await admin.from('enrollments').delete().eq('course_id',courseId);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not update course roster');}
  return enroll(courseId,ids);
}
export async function resolveEmails(emails:string[]) {
  const clean=emails.map(e=>e.trim().toLowerCase()).filter(Boolean);
  const unique=[...new Set(clean)];
  const {data,error}=await adminClient().from('profiles').select('id,email').eq('role','student').in('email',unique);
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not match student emails');
  const matched=data??[];const matchByEmail=new Map(matched.map(row=>[String(row.email).toLowerCase(),String(row.id)]));
  const matchedIds=unique.flatMap(email=>matchByEmail.has(email)?[matchByEmail.get(email)!]:[]);
  return {studentIds:matchedIds,matched:matched.map(p=>({id:p.id,email:p.email})),unknown:unique.filter(e=>!matchByEmail.has(e)),duplicates:clean.filter((e,i)=>clean.indexOf(e)!==i)};
}
export async function unenroll(courseId:string,studentId:string) {
  const {error}=await adminClient().from('enrollments').delete().eq('course_id',courseId).eq('student_id',studentId);
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not remove enrollment');
}
export async function courseMember(profileId:string,role:string,courseId:string,accessToken:string) {
  if(role==='admin')return true;
  const client=userClient(accessToken);const table=role==='teacher'?'course_teachers':'enrollments';const key=role==='teacher'?'teacher_id':'student_id';
  const {data,error}=await client.from(table).select('course_id').eq('course_id',courseId).eq(key,profileId).maybeSingle();
  return !error&&!!data;
}
export async function coursePeople(courseId:string) { return listCoursePeople(courseId); }

