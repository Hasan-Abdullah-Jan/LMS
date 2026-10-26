create policy profiles_read_course_teachers on public.profiles for select to authenticated
using (exists (select 1 from public.enrollments e where e.student_id = profiles.id and public.teaches(e.course_id)));

