create or replace function public.guard_student_submission_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() = 'student' then
    if not exists(select 1 from public.assignments a where a.id = new.assignment_id and (a.allow_late or now() <= a.due_at)) then
      raise exception 'submission deadline has passed';
    end if;
    if tg_op = 'INSERT' and (new.marks_obtained is not null or new.feedback is not null or new.graded_by is not null or new.graded_at is not null) then
      raise exception 'students cannot set grades';
    end if;
    if tg_op = 'UPDATE' and (
      new.assignment_id is distinct from old.assignment_id or new.student_id is distinct from old.student_id or
      new.marks_obtained is not null or new.feedback is not null or new.graded_by is not null or new.graded_at is not null
    ) then raise exception 'students cannot change grades or submission ownership'; end if;
    if new.file_path is not null and new.file_path not like new.assignment_id::text || '/' || new.student_id::text || '/%' then
      raise exception 'invalid submission file path';
    end if;
    new.submitted_at = now();
    new.is_late = exists(select 1 from public.assignments a where a.id = new.assignment_id and now() > a.due_at);
  end if;
  return new;
end $$;
create trigger guard_student_submission_write before insert or update on public.submissions
for each row execute function public.guard_student_submission_write();

create or replace function public.guard_student_quiz_attempt_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() = 'student' and tg_op = 'INSERT' then
    if not exists(select 1 from public.quizzes q where q.id = new.quiz_id and q.is_published and now() between q.opens_at and q.closes_at) then
      raise exception 'quiz is not open';
    end if;
    new.started_at = now(); new.answers = '{}'::jsonb; new.score = null; new.submitted_at = null;
  elsif public.current_role() = 'student' and tg_op = 'UPDATE' then
    if new.quiz_id is distinct from old.quiz_id or new.student_id is distinct from old.student_id or
      new.started_at is distinct from old.started_at or new.score is distinct from old.score or
      new.submitted_at is distinct from old.submitted_at then raise exception 'students cannot change quiz grades or attempt ownership'; end if;
    if now() > old.started_at + (select make_interval(mins => q.time_limit_minutes) from public.quizzes q where q.id = old.quiz_id) + interval '10 seconds' then
      raise exception 'quiz time limit has passed';
    end if;
  end if;
  return new;
end $$;
create trigger guard_student_quiz_attempt_write before update on public.quiz_attempts
for each row execute function public.guard_student_quiz_attempt_write();
