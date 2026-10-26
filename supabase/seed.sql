-- Local development credentials: Demo1234! (change immediately outside local dev).
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','admin@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Alex Morgan"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','teacher1@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Maya Chen"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','teacher2@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Noah Patel"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000004','authenticated','authenticated','student1@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Ava Brooks"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000005','authenticated','authenticated','student2@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Ethan Rivera"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000006','authenticated','authenticated','student3@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Sofia Kim"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000007','authenticated','authenticated','student4@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Liam Johnson"}',now(),now(),false,false),
 ('10000000-0000-4000-8000-000000000008','authenticated','authenticated','student5@northstar.local',extensions.crypt('Demo1234!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Isabella Garcia"}',now(),now(),false,false)
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, roll_no, must_change_password) values
 ('10000000-0000-4000-8000-000000000001','Alex Morgan','admin@northstar.local','admin',null,false),
 ('10000000-0000-4000-8000-000000000002','Maya Chen','teacher1@northstar.local','teacher',null,false),
 ('10000000-0000-4000-8000-000000000003','Noah Patel','teacher2@northstar.local','teacher',null,false),
 ('10000000-0000-4000-8000-000000000004','Ava Brooks','student1@northstar.local','student','NS-2401',false),
 ('10000000-0000-4000-8000-000000000005','Ethan Rivera','student2@northstar.local','student','NS-2402',false),
 ('10000000-0000-4000-8000-000000000006','Sofia Kim','student3@northstar.local','student','NS-2403',false),
 ('10000000-0000-4000-8000-000000000007','Liam Johnson','student4@northstar.local','student','NS-2404',false),
 ('10000000-0000-4000-8000-000000000008','Isabella Garcia','student5@northstar.local','student','NS-2405',false)
on conflict (id) do nothing;

insert into public.courses (id, code, title, description) values
 ('20000000-0000-4000-8000-000000000001','CS101','Foundations of Computer Science','Core concepts, algorithms, and computational thinking.'),
 ('20000000-0000-4000-8000-000000000002','DS202','Data in Practice','Explore, analyze, and communicate with real-world data.'),
 ('20000000-0000-4000-8000-000000000003','UX110','Designing for People','A practical introduction to human-centered design.')
on conflict (id) do nothing;

insert into public.course_teachers (course_id, teacher_id) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003')
on conflict do nothing;

insert into public.enrollments (course_id, student_id)
select c.id, p.id from public.courses c
cross join public.profiles p where p.role = 'student'
on conflict do nothing;

