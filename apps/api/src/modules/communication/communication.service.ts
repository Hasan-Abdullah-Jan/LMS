import {adminClient,userClient} from '../../config/supabase.js';
import {HttpError} from '../../middleware/errors.js';
import {courseMember} from '../courses/courses.service.js';
import type {UserRole} from '../auth/auth.types.js';
type User={id:string;role:UserRole;accessToken:string};
async function courseIds(u:User){
 if(u.role==='admin')return null;
 const t=u.role==='teacher'?'course_teachers':'enrollments',k=u.role==='teacher'?'teacher_id':'student_id';
 const {data,error}=await userClient(u.accessToken).from(t).select('course_id').eq(k,u.id);
 if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load course access');return (data??[]).map(x=>String(x.course_id));
}
function scope<T>(q:T,ids:string[]|null):T{if(ids===null)return q;const query=q as unknown as {or:(filter:string)=>T;is:(column:string,value:null)=>T};return ids.length?query.or('course_id.is.null,course_id.in.('+ids.join(',')+')'):query.is('course_id',null);}
export async function listAnnouncements(u:User,v:{page:number;pageSize:number;courseId?:string|undefined}){
 const c=userClient(u.accessToken),ids=await courseIds(u);
 if(v.courseId&&u.role!=='admin'&&!await courseMember(u.id,u.role,v.courseId,u.accessToken))throw new HttpError(403,'FORBIDDEN','You are not a member of this course');
 let query=c.from('announcements').select('*,profiles(full_name),announcement_reads(read_at)',{count:'exact'}).order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
 query=v.courseId?query.eq('course_id',v.courseId):scope(query,ids);
 const from=(v.page-1)*v.pageSize;const {data,error,count}=await query.range(from,from+v.pageSize-1);if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load announcements');
 let unread=c.from('announcements').select('id',{count:'exact',head:true});unread=scope(unread,ids);
 const {count:total}=await unread;const {count:read}=await c.from('announcement_reads').select('announcements!inner(id)',{count:'exact',head:true});
 const rows=(data??[]).map((a:Record<string,unknown>)=>{const reads=(a.announcement_reads??[]) as {read_at:string}[];const author=a.profiles as {full_name:string}|null;return {id:a.id,courseId:a.course_id,authorId:a.author_id,author:author?{fullName:author.full_name}:null,title:a.title,body:a.body,isPinned:a.is_pinned,createdAt:a.created_at,read:reads.length>0,readAt:reads[0]?.read_at??null};});
 return {data:rows,meta:{page:v.page,pageSize:v.pageSize,total:count??0,unreadCount:Math.max(0,(total??0)-(read??0))}};
}
export async function createAnnouncement(u:User,v:{courseId?:string|null|undefined;title:string;body:string;isPinned:boolean}){
 if(u.role==='student')throw new HttpError(403,'FORBIDDEN','Teachers and admins only');
 const courseId=v.courseId??null;if(u.role==='teacher'&&(!courseId||!await courseMember(u.id,u.role,courseId,u.accessToken)))throw new HttpError(403,'FORBIDDEN','Teachers can post only to their own courses');
 const {data,error}=await userClient(u.accessToken).from('announcements').insert({course_id:courseId,author_id:u.id,title:v.title,body:v.body,is_pinned:v.isPinned}).select('*').single();
 if(error||!data)throw new HttpError(422,'ANNOUNCEMENT_CREATE_FAILED','Could not create announcement');
 return {id:data.id,courseId:data.course_id,title:data.title,body:data.body,isPinned:data.is_pinned,createdAt:data.created_at};
}
export async function updateAnnouncement(u:User,id:string,v:Record<string,unknown>){
 const c=userClient(u.accessToken);const {data,error:readError}=await c.from('announcements').select('id').eq('id',id).maybeSingle();if(readError||!data)throw new HttpError(404,'NOT_FOUND','Announcement not found');
 const p:Record<string,unknown>={};if(v.title!==undefined)p.title=v.title;if(v.body!==undefined)p.body=v.body;if(v.isPinned!==undefined)p.is_pinned=v.isPinned;
 const {data:row,error}=await c.from('announcements').update(p).eq('id',id).select('*').maybeSingle();if(error)throw new HttpError(403,'FORBIDDEN','You cannot update this announcement');if(!row)throw new HttpError(404,'NOT_FOUND','Announcement not found');
 return {id:row.id,courseId:row.course_id,title:row.title,body:row.body,isPinned:row.is_pinned,createdAt:row.created_at};
}
export async function deleteAnnouncement(u:User,id:string){
 const {data,error}=await userClient(u.accessToken).from('announcements').delete().eq('id',id).select('id').maybeSingle();if(error)throw new HttpError(403,'FORBIDDEN','You cannot delete this announcement');if(!data)throw new HttpError(404,'NOT_FOUND','Announcement not found');
}
export async function markAnnouncementsRead(u:User,upTo:string){
 const c=userClient(u.accessToken),ids=await courseIds(u);let q=c.from('announcements').select('id').lte('created_at',upTo);q=scope(q,ids);
 const {data,error}=await q;if(error)throw new HttpError(500,'DATABASE_ERROR','Could not mark announcements as read');
 const rows=(data??[]).map(a=>({user_id:u.id,announcement_id:a.id,read_at:new Date().toISOString()}));
 if(rows.length){const {error:saveError}=await c.from('announcement_reads').upsert(rows,{onConflict:'user_id,announcement_id'});if(saveError)throw new HttpError(500,'DATABASE_ERROR','Could not mark announcements as read');}
 return {updated:rows.length};
}
export async function listMessages(u:User,cid:string,before?:string,limit=50){
 if(!await courseMember(u.id,u.role,cid,u.accessToken))throw new HttpError(403,'FORBIDDEN','You are not a member of this course');
 let q=userClient(u.accessToken).from('chat_messages').select('id,course_id,sender_id,body,created_at,deleted_at,profiles(full_name,role)').eq('course_id',cid).order('created_at',{ascending:false}).limit(limit);
 if(before)q=q.lt('created_at',before);const {data,error}=await q;if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load chat messages');
 const rows=(data??[]).map((m:Record<string,unknown>)=>({id:m.id,courseId:m.course_id,senderId:m.sender_id,sender:m.profiles,body:m.deleted_at?'Deleted message':m.body,createdAt:m.created_at,deleted:!!m.deleted_at}));
 return {data:rows.reverse(),meta:{limit,nextBefore:rows[0]?.createdAt??null}};
}
export async function sendMessage(u:User,cid:string,body:string){
 if(!await courseMember(u.id,u.role,cid,u.accessToken))throw new HttpError(403,'FORBIDDEN','You are not a member of this course');
 const {data,error}=await userClient(u.accessToken).from('chat_messages').insert({course_id:cid,sender_id:u.id,body}).select('id,course_id,sender_id,body,created_at,deleted_at,profiles(full_name,role)').single();
 if(error||!data)throw new HttpError(422,'MESSAGE_SEND_FAILED','Could not send message');
 return {id:data.id,courseId:data.course_id,senderId:data.sender_id,sender:data.profiles,body:data.body,createdAt:data.created_at,deleted:false};
}
export async function deleteMessage(u:User,id:string){
 const c=userClient(u.accessToken);const {data,error}=await c.from('chat_messages').select('id,course_id,sender_id,created_at').eq('id',id).maybeSingle();if(error||!data)throw new HttpError(404,'NOT_FOUND','Message not found');
 if(u.role!=='admin'&&data.sender_id!==u.id){
  if(u.role!=='teacher'||!await courseMember(u.id,u.role,String(data.course_id),u.accessToken))throw new HttpError(403,'FORBIDDEN','You cannot delete this message');
 }else if(u.role!=='admin'&&data.sender_id===u.id&&Date.now()-new Date(data.created_at).getTime()>5*60_000)throw new HttpError(403,'FORBIDDEN','Messages can be deleted by their sender for five minutes');
 const {error:updateError}=await c.from('chat_messages').update({deleted_at:new Date().toISOString()}).eq('id',id);if(updateError)throw new HttpError(403,'FORBIDDEN','Could not delete message');
 await adminClient().from('audit_log').insert({actor_id:u.id,action:'chat.deleted',entity:'chat_message',entity_id:id});
}

