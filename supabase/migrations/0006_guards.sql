-- =============================================================================
-- 0006_guards.sql
-- Data-integrity triggers. They enforce business rules even if someone calls
-- Supabase directly with a user JWT. Writes performed by the API's service
-- role (auth.uid() is null) are trusted and skip the guards.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: email is owned by Supabase Auth and cannot drift.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id <> old.id or new.email <> old.email then
    raise exception 'Profile id and email cannot be changed' using errcode = '42501';
  end if;
  if new.id = auth.uid() and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'You cannot change your own role or status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -----------------------------------------------------------------------------
-- submissions: server-side lateness, deadline enforcement, grade protection.
-- -----------------------------------------------------------------------------
create or replace function public.guard_submission_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
begin
  if auth.uid() is null then
    return new;
  end if;

  select * into v_assignment from public.assignments where id = new.assignment_id;
  if not found then
    raise exception 'Assignment not found' using errcode = '23503';
  end if;

  -- Student creating or replacing their own submission
  if public.auth_role() = 'student' and new.student_id = auth.uid() then
    if tg_op = 'UPDATE'
       and (new.assignment_id <> old.assignment_id or new.student_id <> old.student_id) then
      raise exception 'Submission ownership cannot change' using errcode = '42501';
    end if;
    if now() > v_assignment.due_at and not v_assignment.allow_late then
      raise exception 'The deadline for this assignment has passed' using errcode = 'P0001';
    end if;
    new.submitted_at   := now();
    new.is_late        := now() > v_assignment.due_at;
    -- Resubmission clears any previous grade.
    new.marks_obtained := null;
    new.feedback       := null;
    new.graded_by      := null;
    new.graded_at      := null;
    return new;
  end if;

  -- Staff grading
  if tg_op = 'INSERT' then
    raise exception 'Only students can create submissions' using errcode = '42501';
  end if;
  if new.assignment_id <> old.assignment_id
     or new.student_id <> old.student_id
     or new.text_answer is distinct from old.text_answer
     or new.file_path is distinct from old.file_path
     or new.file_name is distinct from old.file_name
     or new.submitted_at <> old.submitted_at
     or new.is_late <> old.is_late then
    raise exception 'Graders may only change marks and feedback' using errcode = '42501';
  end if;
  if new.marks_obtained is not null and new.marks_obtained > v_assignment.max_marks then
    raise exception 'Marks cannot exceed %', v_assignment.max_marks using errcode = '23514';
  end if;
  new.graded_by := auth.uid();
  new.graded_at := case when new.marks_obtained is null then null else now() end;
  return new;
end;
$$;

create trigger submissions_guard_write
  before insert or update on public.submissions
  for each row execute function public.guard_submission_write();

-- -----------------------------------------------------------------------------
-- quizzes: once any attempt exists only the publish flag may change, and the
-- questions / answer keys are frozen.
-- -----------------------------------------------------------------------------
create or replace function public.quiz_has_attempts(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.quiz_attempts where quiz_id = target_quiz_id)
$$;

revoke all on function public.quiz_has_attempts(uuid) from public, anon;
grant execute on function public.quiz_has_attempts(uuid) to authenticated, service_role;

create or replace function public.guard_quiz_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.quiz_has_attempts(old.id) then
    return new;
  end if;
  if new.course_id <> old.course_id
     or new.title <> old.title
     or new.description is distinct from old.description
     or new.time_limit_minutes <> old.time_limit_minutes
     or new.opens_at <> old.opens_at
     or new.closes_at <> old.closes_at
     or new.shuffle_questions <> old.shuffle_questions then
    raise exception 'This quiz already has attempts; only publishing can change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger quizzes_guard_update
  before update on public.quizzes
  for each row execute function public.guard_quiz_update();

create or replace function public.guard_quiz_question_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'quiz_questions' then
    v_quiz_id := coalesce(new.quiz_id, old.quiz_id);
  else
    select qq.quiz_id into v_quiz_id
    from public.quiz_questions qq
    where qq.id = coalesce(new.question_id, old.question_id);
  end if;
  if v_quiz_id is not null and public.quiz_has_attempts(v_quiz_id) then
    raise exception 'This quiz already has attempts; questions are locked' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quiz_questions_guard_write
  before insert or update or delete on public.quiz_questions
  for each row execute function public.guard_quiz_question_write();

create trigger quiz_answers_guard_write
  before insert or update or delete on public.quiz_answers
  for each row execute function public.guard_quiz_question_write();

-- -----------------------------------------------------------------------------
-- chat_messages: immutable except for a one-way soft delete.
-- -----------------------------------------------------------------------------
create or replace function public.guard_chat_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.body <> old.body
     or new.sender_id <> old.sender_id
     or new.course_id <> old.course_id
     or new.created_at <> old.created_at then
    raise exception 'Chat messages cannot be edited' using errcode = '42501';
  end if;
  if old.deleted_at is not null or new.deleted_at is null then
    raise exception 'Messages can only be deleted once' using errcode = '42501';
  end if;
  new.deleted_at := now();
  new.deleted_by := auth.uid();
  return new;
end;
$$;

create trigger chat_messages_guard_update
  before update on public.chat_messages
  for each row execute function public.guard_chat_message_update();

-- -----------------------------------------------------------------------------
-- complaints: status flow open -> in_review -> resolved | rejected, response
-- required to close, complainants may add exactly one follow-up comment.
-- -----------------------------------------------------------------------------
create or replace function public.guard_complaint_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.raised_by <> old.raised_by
     or new.course_id is distinct from old.course_id
     or new.category <> old.category
     or new.subject <> old.subject
     or new.description <> old.description
     or new.attachment_path is distinct from old.attachment_path
     or new.created_at <> old.created_at then
    raise exception 'Complaints cannot be edited after filing' using errcode = '42501';
  end if;

  if public.is_admin() then
    if new.follow_up is distinct from old.follow_up then
      raise exception 'Only the complainant can add a follow-up' using errcode = '42501';
    end if;
    if new.status <> old.status and not (
         (old.status = 'open' and new.status = 'in_review')
      or (old.status = 'in_review' and new.status in ('resolved', 'rejected'))
    ) then
      raise exception 'Invalid status change from % to %', old.status, new.status using errcode = '23514';
    end if;
    if new.status in ('resolved', 'rejected') and coalesce(btrim(new.admin_response), '') = '' then
      raise exception 'A response is required to resolve or reject a complaint' using errcode = '23514';
    end if;
    if new.status in ('resolved', 'rejected') and old.status not in ('resolved', 'rejected') then
      new.resolved_by := auth.uid();
      new.resolved_at := now();
    end if;
    return new;
  end if;

  -- Complainant: one follow-up comment only.
  if new.status <> old.status
     or new.admin_response is distinct from old.admin_response
     or new.resolved_by is distinct from old.resolved_by
     or new.resolved_at is distinct from old.resolved_at then
    raise exception 'Only administrators can change the status' using errcode = '42501';
  end if;
  if old.follow_up is not null then
    raise exception 'A follow-up has already been added' using errcode = 'P0001';
  end if;
  new.follow_up_at := now();
  return new;
end;
$$;

create trigger complaints_guard_update
  before update on public.complaints
  for each row execute function public.guard_complaint_update();
