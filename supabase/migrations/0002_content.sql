create table public.resources (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), title text not null, description text,
  file_path text not null, file_name text not null, mime_type text not null, size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, instructions text not null,
  max_marks numeric(6,2) not null check (max_marks > 0), due_at timestamptz not null,
  allow_late boolean not null default false, attachment_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, text_answer text, file_path text,
  submitted_at timestamptz not null default now(), is_late boolean not null default false,
  marks_obtained numeric(6,2), feedback text, graded_by uuid references public.profiles(id), graded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (assignment_id, student_id), check (marks_obtained is null or marks_obtained >= 0)
);
create table public.quizzes (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null, description text,
  time_limit_minutes int not null check (time_limit_minutes > 0), opens_at timestamptz not null,
  closes_at timestamptz not null, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (closes_at > opens_at)
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null, type public.question_type not null, prompt text not null,
  options jsonb not null, marks numeric(5,2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (quiz_id, position)
);
create table public.quiz_answers (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_option_ids text[] not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, started_at timestamptz not null default now(),
  submitted_at timestamptz, answers jsonb not null default '{}', score numeric(6,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (quiz_id, student_id), check (score is null or score >= 0)
);
create table public.announcements (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id), title text not null, body text not null,
  is_pinned boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.announcement_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(), created_at timestamptz not null default now(), primary key (user_id, announcement_id)
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.complaints (
  id uuid primary key default gen_random_uuid(), raised_by uuid not null references public.profiles(id),
  course_id uuid references public.courses(id), category text not null,
  subject text not null, description text not null, attachment_path text,
  status public.complaint_status not null default 'open', admin_response text,
  resolved_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.v_student_marks with (security_invoker = true) as
  select s.student_id, a.course_id, 'assignment'::text as kind, s.id as item_id,
         a.title, s.marks_obtained as obtained, a.max_marks as max, s.graded_at
  from public.submissions s join public.assignments a on a.id = s.assignment_id where s.graded_at is not null
  union all
  select qa.student_id, q.course_id, 'quiz'::text as kind, q.id as item_id,
         q.title, qa.score as obtained,
         (select coalesce(sum(qq.marks), 0) from public.quiz_questions qq where qq.quiz_id = q.id) as max,
         qa.submitted_at as graded_at
  from public.quiz_attempts qa join public.quizzes q on q.id = qa.quiz_id
  where qa.submitted_at is not null and qa.score is not null;

create index resources_course_created_idx on public.resources (course_id, created_at desc);
create index assignments_course_due_idx on public.assignments (course_id, due_at);
create index submissions_assignment_idx on public.submissions (assignment_id);
create index submissions_student_idx on public.submissions (student_id);
create index quizzes_course_idx on public.quizzes (course_id, opens_at);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);
create index announcements_course_created_idx on public.announcements (course_id, created_at desc);
create index chat_messages_course_created_idx on public.chat_messages (course_id, created_at desc);
create index complaints_status_created_idx on public.complaints (status, created_at desc);

