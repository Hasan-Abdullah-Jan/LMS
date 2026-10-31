-- =============================================================================
-- 0004_views.sql
-- Marks are derived, never duplicated: assignment marks live in
-- submissions.marks_obtained and quiz marks in quiz_attempts.score.
-- v_student_marks unions both. Ungraded submissions appear with obtained = null
-- so the UI can show "Pending"; they are excluded from totals.
-- security_invoker = true makes the view respect the caller's RLS.
-- =============================================================================

create or replace view public.v_student_marks
with (security_invoker = true)
as
  select
    s.student_id,
    a.course_id,
    'assignment'::text                                   as kind,
    a.id                                                 as item_id,
    a.title,
    case when s.graded_at is not null then s.marks_obtained end as obtained,
    a.max_marks                                          as max,
    s.graded_at,
    s.id                                                 as source_id
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  union all
  select
    qa.student_id,
    q.course_id,
    'quiz'::text                                         as kind,
    q.id                                                 as item_id,
    q.title,
    qa.score                                             as obtained,
    (
      select coalesce(sum(qq.marks), 0)
      from public.quiz_questions qq
      where qq.quiz_id = q.id
    )::numeric(6, 2)                                     as max,
    qa.submitted_at                                      as graded_at,
    qa.id                                                as source_id
  from public.quiz_attempts qa
  join public.quizzes q on q.id = qa.quiz_id
  where qa.submitted_at is not null;

comment on view public.v_student_marks is
  'Unified marks per student: (student_id, course_id, kind, item_id, title, obtained, max, graded_at).';

grant select on public.v_student_marks to authenticated, service_role;
