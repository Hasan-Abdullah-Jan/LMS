import { randomUUID } from 'node:crypto';
import { adminClient, userClient } from '../../config/supabase.js';
import { HttpError } from '../../middleware/errors.js';
import { courseMember } from '../courses/courses.service.js';

export function allowedFile(file:{originalname:string;mimetype:string;buffer:Buffer}) {
  const name=file.originalname.toLowerCase();const b=file.buffer;
  if(name.endsWith('.exe')||name.endsWith('.msi')||name.endsWith('.js')||name.endsWith('.bat'))return false;
  const expected=name.endsWith('.pdf')?'application/pdf':name.endsWith('.png')?'image/png':name.endsWith('.jpg')||name.endsWith('.jpeg')?'image/jpeg':name.endsWith('.gif')?'image/gif':name.endsWith('.webp')?'image/webp':name.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':name.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':name.endsWith('.zip')?'application/zip':null;
  if(!expected||file.mimetype!==expected)return false;
  if(name.endsWith('.pdf'))return b.subarray(0,5).toString()==='%PDF-';
  if(name.endsWith('.png'))return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(name.endsWith('.jpg')||name.endsWith('.jpeg'))return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(name.endsWith('.gif'))return ['GIF87a','GIF89a'].includes(b.subarray(0,6).toString());
  if(name.endsWith('.webp'))return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  if(name.endsWith('.zip')||name.endsWith('.docx')||name.endsWith('.pptx'))return b[0]===0x50&&b[1]===0x4b;
  return false;
}
const mapResource=(r:Record<string,unknown>)=>({id:r.id,courseId:r.course_id,title:r.title,description:r.description,fileName:r.file_name,mimeType:r.mime_type,sizeBytes:r.size_bytes,createdAt:r.created_at,uploadedBy:r.uploaded_by});
async function assertMember(user:{id:string;role:string;accessToken:string},courseId:string) {
  if(!await courseMember(user.id,user.role,courseId,user.accessToken))throw new HttpError(403,'FORBIDDEN','You are not a member of this course');
}
export async function listResources(user:{id:string;role:string;accessToken:string},courseId:string,query:{page:number;pageSize:number;search?:string|undefined}) {
  await assertMember(user,courseId);const client=userClient();
  let q=client.from('resources').select('*',{count:'exact'}).eq('course_id',courseId).order('created_at',{ascending:false});
  if(query.search)q=q.ilike('title',`%${query.search}%`);
  const from=(query.page-1)*query.pageSize;const {data,error,count}=await q.range(from,from+query.pageSize-1);
  if(error)throw new HttpError(500,'DATABASE_ERROR','Could not load resources');
  return {data:(data??[]).map(mapResource),meta:{page:query.page,pageSize:query.pageSize,total:count??0}};
}
export async function uploadResource(user:{id:string;role:string;accessToken:string},courseId:string,file:Express.Multer.File,title:string,description?:string) {
  if(user.role==='student')throw new HttpError(403,'FORBIDDEN','Teachers only');
  await assertMember(user,courseId);
  if(!allowedFile(file))throw new HttpError(422,'FILE_TYPE_NOT_ALLOWED','Choose a PDF, DOCX, PPTX, image, or ZIP file');
  const safeName=file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120);
  const path=`${courseId}/${randomUUID()}-${safeName}`;const client=userClient(user.accessToken);
  const {error:uploadError}=await client.storage.from('resources').upload(path,file.buffer,{contentType:file.mimetype,upsert:false});
  if(uploadError)throw new HttpError(422,'UPLOAD_FAILED','Could not upload this file');
  const {data,error}=await client.from('resources').insert({course_id:courseId,uploaded_by:user.id,title,description:description??null,file_path:path,file_name:file.originalname,mime_type:file.mimetype,size_bytes:file.size}).select('*').single();
  if(error||!data){await client.storage.from('resources').remove([path]);throw new HttpError(422,'RESOURCE_CREATE_FAILED','Could not save this resource');}
  return mapResource(data);
}
export async function resourceDownload(user:{id:string;role:string;accessToken:string},resourceId:string) {
  const admin=adminClient();const {data,error}=await admin.from('resources').select('id,course_id,file_path,file_name').eq('id',resourceId).maybeSingle();
  if(error||!data)throw new HttpError(404,'NOT_FOUND','Resource not found');
  await assertMember(user,String(data.course_id));
  const client=userClient(user.accessToken);const {data:signed,error:signedError}=await client.storage.from('resources').createSignedUrl(data.file_path,60);
  if(signedError||!signed)throw new HttpError(500,'SIGNED_URL_FAILED','Could not create a download link');
  return {url:signed.signedUrl,expiresIn:60,fileName:data.file_name};
}
export async function deleteResource(user:{id:string;role:string;accessToken:string},resourceId:string) {
  const client=userClient(user.accessToken);const {data,error}=await adminClient().from('resources').select('*').eq('id',resourceId).maybeSingle();
  if(error||!data)throw new HttpError(404,'NOT_FOUND','Resource not found');
  if(user.role!=='admin'&&(!await courseMember(user.id,user.role,String(data.course_id),user.accessToken)||data.uploaded_by!==user.id))throw new HttpError(403,'FORBIDDEN','You cannot delete this resource');
  const {error:removeError}=await client.storage.from('resources').remove([data.file_path]);
  if(removeError)throw new HttpError(500,'DELETE_FAILED','Could not delete the stored file');
  const {error:rowError}=await client.from('resources').delete().eq('id',resourceId);
  if(rowError)throw new HttpError(500,'DELETE_FAILED','Could not remove the resource record');
  await adminClient().from('audit_log').insert({actor_id:user.id,action:'resource.deleted',entity:'resource',entity_id:resourceId});
}

