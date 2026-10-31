-- =============================================================================
-- 0005_rls.sql
-- Row Level Security on every table. The API performs explicit authorization
-- first; these policies are the second line of defense for any direct
-- Supabase client call (including Realtime subscriptions).
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'courses', 'course_teachers', 'enrollments', 'audit_log',
    'resources', 'assignments', 'submissions', 'quizzes', 'quiz_questions',
    'quiz_answers', 'quiz_attempts', 'announcements', 'announcement_reads',
    'chat_messages', 'complaints', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Anonymous visitors never touch application data.
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end;
$$;

revoke all on public.v_student_marks from anon;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_profile(id));

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- courses / course_teachers / enrollments
-- -----------------------------------------------------------------------------
create policy courses_select on public.courses
  for select to authenticated
  using (
    public.is_admin()
    or (not is_archived and (public.teaches(id) or public.is_enrolled(id)))
  );

create policy courses_admin_insert on public.courses
  for insert to authenticated
  with check (public.is_admin());

create policy courses_admin_update on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy course_teachers_select on public.course_teachers
  for select to authenticated
  using (public.is_course_member(course_id));

create policy course_teachers_admin_insert on public.course_teachers
  for insert to authenticated
  with check (public.is_admin());

create policy course_teachers_admin_delete on public.course_teachers
  for delete to authenticated
  using (public.is_admin());

create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.teaches(course_id)
    or public.is_enrolled(course_id)
  );

create policy enrollments_admin_insert on public.enrollments
  for insert to authenticated
  with check (public.is_admin());

create policy enrollments_admin_delete on public.enrollments
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- audit_log: admins read; only the service role writes.
-- -----------------------------------------------------------------------------
create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- resources
-- -----------------------------------------------------------------------------
create policy resources_select on public.resources
  for select to authenticated
  using (public.is_course_member(course_id));

create policy resources_insert on public.resources
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_admin() or public.teaches(course_id))
  );

create policy resources_delete on public.resources
  for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- -----------------------------------------------------------------------------
-- assignments
-- -----------------------------------------------------------------------------
create policy assignments_select on public.assignments
  for select to authenticated
  using (public.is_course_member(course_id));

create policy assignments_insert on public.assignments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_admin() or public.teaches(course_id))
  );

create policy assignments_update on public.assignments
  for update to authenticated
  using (public.is_admin() or public.teaches(course_id))
  with check (public.is_admin() or public.teaches(course_id));

create policy assignments_delete on public.assignments
  for delete to authenticated
  using (public.is_admin() or public.teaches(course_id));

-- -----------------------------------------------------------------------------
-- submissions: students see only their own; teachers see their courses.
-- -----------------------------------------------------------------------------
create policy submissions_select on public.submissions
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.teaches(a.course_id)
    )
  );

create policy submissions_student_insert on public.submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.auth_role() = 'student'
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.is_enrolled(a.course_id)
    )
  );

create policy submissions_update on public.submissions
  for update to authenticated
  using (
    (student_id = auth.uid() and public.auth_role() = 'student')
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.teaches(a.course_id)
    )
  )
  with check (
    (student_id = auth.uid() and public.auth_role() = 'student')
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.teaches(a.course_id)
    )
  );

-- -----------------------------------------------------------------------------
-- quizzes / questions / answer keys / attempts
-- -----------------------------------------------------------------------------
create policy quizzes_select on public.quizzes
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches(course_id)
    or (is_published and public.is_enrolled(course_id))
  );

create policy quizzes_insert on public.quizzes
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_admin() or public.teaches(course_id))
  );

create policy quizzes_update on public.quizzes
  for update to authenticated
  using (public.is_admin() or public.teaches(course_id))
  with check (public.is_admin() or public.teaches(course_id));

create policy quizzes_delete on public.quizzes
  for delete to authenticated
  using (public.is_admin() or public.teaches(course_id));

-- Students may only read the questions of a quiz they have already started.
create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
        and (
          public.is_admin()
          or public.teaches(q.course_id)
          or exists (
            select 1 from public.quiz_attempts qa
            where qa.quiz_id = q.id and qa.student_id = auth.uid()
          )
        )
    )
  );

create policy quiz_questions_write on public.quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and (public.is_admin() or public.teaches(q.course_id))
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and (public.is_admin() or public.teaches(q.course_id))
    )
  );

-- Answer keys: teachers of the course and admins only. Never students.
create policy quiz_answers_staff_only on public.quiz_answers
  for all to authenticated
  using (
    exists (
      select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and (public.is_admin() or public.teaches(q.course_id))
    )
  )
  with check (
    exists (
      select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = question_id and (public.is_admin() or public.teaches(q.course_id))
    )
  );

-- Attempts are created and graded by the API (service role) so students can
-- never write a score. Students read their own; staff read their courses.
create policy quiz_attempts_select on public.quiz_attempts
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and public.teaches(q.course_id)
    )
  );

-- -----------------------------------------------------------------------------
-- announcements & read receipts
-- -----------------------------------------------------------------------------
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    course_id is null
    or public.is_course_member(course_id)
  );

create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin()
      or (course_id is not null and public.teaches(course_id))
    )
  );

create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_admin() or author_id = auth.uid())
  with check (
    public.is_admin()
    or (author_id = auth.uid() and course_id is not null and public.teaches(course_id))
  );

create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_admin() or author_id = auth.uid());

create policy announcement_reads_own on public.announcement_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- chat (also governs Realtime postgres_changes delivery)
-- -----------------------------------------------------------------------------
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (public.is_course_member(course_id));

create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and deleted_at is null
    and (public.teaches(course_id) or public.is_enrolled(course_id))
  );

create policy chat_messages_soft_delete on public.chat_messages
  for update to authenticated
  using (
    public.is_admin()
    or public.teaches(course_id)
    or (sender_id = auth.uid() and created_at > now() - interval '5 minutes')
  )
  with check (
    public.is_admin()
    or public.teaches(course_id)
    or sender_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- complaints
-- -----------------------------------------------------------------------------
create policy complaints_select on public.complaints
  for select to authenticated
  using (raised_by = auth.uid() or public.is_admin());

create policy complaints_insert on public.complaints
  for insert to authenticated
  with check (
    raised_by = auth.uid()
    and public.auth_role() in ('student', 'teacher')
    and status = 'open'
  );

create policy complaints_update on public.complaints
  for update to authenticated
  using (public.is_admin() or raised_by = auth.uid())
  with check (public.is_admin() or raised_by = auth.uid());

-- -----------------------------------------------------------------------------
-- notifications: users read and acknowledge their own.
-- -----------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

