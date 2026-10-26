do $$
declare t text;
begin
  foreach t in array array['profiles','courses','course_teachers','enrollments','audit_log','resources','assignments','submissions','quizzes','quiz_questions','quiz_answers','quiz_attempts','announcements','announcement_reads','chat_messages','complaints'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.current_role() = 'admin');
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy courses_read_members on public.courses for select to authenticated
using (public.current_role() = 'admin' or (not is_archived and (public.teaches(id) or public.is_enrolled(id))));
create policy courses_admin_write on public.courses for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy course_teachers_read on public.course_teachers for select to authenticated
using (teacher_id = auth.uid() or public.current_role() = 'admin' or public.is_enrolled(course_id));
create policy course_teachers_admin_write on public.course_teachers for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
create policy enrollments_read on public.enrollments for select to authenticated
using (student_id = auth.uid() or public.teaches(course_id) or public.current_role() = 'admin');
create policy enrollments_admin_write on public.enrollments for all to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy resources_read_members on public.resources for select to authenticated
using (public.is_course_member(course_id));
create policy resources_teacher_insert on public.resources for insert to authenticated
with check (public.current_role() = 'admin' or (public.teaches(course_id) and uploaded_by = auth.uid()));
create policy resources_teacher_delete on public.resources for delete to authenticated
using (public.current_role() = 'admin' or (public.teaches(course_id) and uploaded_by = auth.uid()));

create policy assignments_read_members on public.assignments for select to authenticated
using (public.is_course_member(course_id));
create policy assignments_teacher_write on public.assignments for all to authenticated
using (public.current_role() = 'admin' or public.teaches(course_id))
with check (public.current_role() = 'admin' or (public.teaches(course_id) and created_by = auth.uid()));
create policy submissions_student_read on public.submissions for select to authenticated
using (student_id = auth.uid() or public.current_role() = 'admin' or exists (
  select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id)
));
create policy submissions_student_insert on public.submissions for insert to authenticated
with check (public.current_role() = 'student' and student_id = auth.uid() and exists (
  select 1 from public.assignments a where a.id = assignment_id and public.is_enrolled(a.course_id)
 ) and marks_obtained is null and feedback is null and graded_by is null and graded_at is null);
create policy submissions_student_update on public.submissions for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());
create policy submissions_teacher_grade on public.submissions for update to authenticated
using (public.current_role() = 'admin' or exists (
  select 1 from public.assignments a where a.id = assignment_id and public.teaches(a.course_id)
)) with check (public.current_role() = 'admin' or graded_by = auth.uid());

create policy quizzes_read_members on public.quizzes for select to authenticated
using (public.current_role() = 'admin' or public.teaches(course_id) or (public.is_enrolled(course_id) and is_published));
create policy quizzes_teacher_write on public.quizzes for all to authenticated
using (public.current_role() = 'admin' or public.teaches(course_id))
with check (public.current_role() = 'admin' or (public.teaches(course_id) and created_by = auth.uid()));
create policy questions_read_course on public.quiz_questions for select to authenticated
using (public.current_role() = 'admin' or exists (
  select 1 from public.quizzes q where q.id = quiz_id and (public.teaches(q.course_id) or (q.is_published and public.is_enrolled(q.course_id)))
));
create policy questions_teacher_write on public.quiz_questions for all to authenticated
using (public.current_role() = 'admin' or exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches(q.course_id)))
with check (public.current_role() = 'admin' or exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches(q.course_id)));
create policy answers_teacher_only on public.quiz_answers for all to authenticated
using (public.current_role() = 'admin' or exists (
  select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.teaches(q.course_id)
)) with check (public.current_role() = 'admin' or exists (
  select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where qq.id = question_id and public.teaches(q.course_id)
));
create policy attempts_read_own_or_teacher on public.quiz_attempts for select to authenticated
using (student_id = auth.uid() or public.current_role() = 'admin' or exists (select 1 from public.quizzes q where q.id = quiz_id and public.teaches(q.course_id)));
create policy attempts_student_insert on public.quiz_attempts for insert to authenticated
with check (public.current_role() = 'student' and student_id = auth.uid() and exists (
  select 1 from public.quizzes q where q.id = quiz_id and q.is_published and public.is_enrolled(q.course_id)
));
create policy attempts_student_update on public.quiz_attempts for update to authenticated
using (student_id = auth.uid() and submitted_at is null) with check (student_id = auth.uid());

create policy announcements_read_scope on public.announcements for select to authenticated
using (course_id is null or public.current_role() = 'admin' or public.teaches(course_id) or public.is_enrolled(course_id));
create policy announcements_insert_scope on public.announcements for insert to authenticated
with check ((public.current_role() = 'admin' and (course_id is null or public.teaches(course_id))) or
  (public.current_role() = 'teacher' and course_id is not null and public.teaches(course_id) and author_id = auth.uid()));
create policy announcements_update_author on public.announcements for update to authenticated
using (public.current_role() = 'admin' or author_id = auth.uid())
with check (public.current_role() = 'admin' or author_id = auth.uid());
create policy announcements_delete_author on public.announcements for delete to authenticated
using (public.current_role() = 'admin' or author_id = auth.uid());
create policy announcement_reads_self on public.announcement_reads for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_read_members on public.chat_messages for select to authenticated
using (public.is_course_member(course_id));
create policy chat_insert_members on public.chat_messages for insert to authenticated
with check (sender_id = auth.uid() and (public.current_role() = 'admin' or public.teaches(course_id) or public.is_enrolled(course_id)));
create policy chat_soft_delete on public.chat_messages for update to authenticated
using (sender_id = auth.uid() or public.current_role() = 'admin' or public.teaches(course_id))
with check (sender_id = auth.uid() or public.current_role() = 'admin' or public.teaches(course_id));

create policy complaints_read_self_or_admin on public.complaints for select to authenticated
using (raised_by = auth.uid() or public.current_role() = 'admin');
create policy complaints_create on public.complaints for insert to authenticated
with check (raised_by = auth.uid() and public.current_role() in ('student','teacher'));
create policy complaints_admin_update on public.complaints for update to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy audit_admin_read on public.audit_log for select to authenticated using (public.current_role() = 'admin');
create policy audit_insert_actor on public.audit_log for insert to authenticated with check (actor_id = auth.uid());

grant select on public.v_student_marks to authenticated;
create policy storage_resources_read on storage.objects for select to authenticated
using (bucket_id = 'resources' and public.is_course_member((storage.foldername(name))[1]::uuid));
create policy storage_resources_insert on storage.objects for insert to authenticated
with check (bucket_id = 'resources' and (public.current_role() = 'admin' or public.teaches((storage.foldername(name))[1]::uuid)));
create policy storage_resources_delete on storage.objects for delete to authenticated
using (bucket_id = 'resources' and (public.current_role() = 'admin' or public.teaches((storage.foldername(name))[1]::uuid)));
create policy storage_submission_read on storage.objects for select to authenticated
using (bucket_id = 'submissions' and (
  public.current_role() = 'admin' or
  (storage.foldername(name))[2] = auth.uid()::text or
  exists (select 1 from public.assignments a where a.id::text = (storage.foldername(name))[1] and public.teaches(a.course_id))
));
create policy storage_submission_insert on storage.objects for insert to authenticated
with check (bucket_id = 'submissions' and owner_id = auth.uid()::text and
  (storage.foldername(name))[2] = auth.uid()::text and public.current_role() = 'student' and
  exists (select 1 from public.assignments a where a.id::text = (storage.foldername(name))[1] and public.is_enrolled(a.course_id))
);
create policy storage_complaint_read on storage.objects for select to authenticated
using (bucket_id = 'complaint-attachments' and (owner_id = auth.uid()::text or public.current_role() = 'admin'));
create policy storage_complaint_insert on storage.objects for insert to authenticated
with check (bucket_id = 'complaint-attachments' and owner_id = auth.uid()::text and public.current_role() in ('student','teacher'));
