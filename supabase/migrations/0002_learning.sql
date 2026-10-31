-- =============================================================================
-- 0002_learning.sql
-- Learning content: resources, assignments + submissions, quizzes + questions,
-- answer keys (isolated table) and attempts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Resources (files live in the private "resources" storage bucket)
-- -----------------------------------------------------------------------------
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  file_path   text not null unique,
  file_name   text not null,
  mime_type   text not null,
  size_bytes  bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at  timestamptz not null default now()
);

create index resources_course_created_idx on public.resources (course_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Assignments & submissions
-- -----------------------------------------------------------------------------
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete cascade,
  created_by      uuid not null references public.profiles (id),
  title           text not null check (char_length(title) between 1 and 200),
  instructions    text not null,
  max_marks       numeric(6, 2) not null check (max_marks > 0),
  due_at          timestamptz not null,
  allow_late      boolean not null default false,
  attachment_path text,
  attachment_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

create index assignments_course_due_idx on public.assignments (course_id, due_at);

create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  text_answer    text,
  file_path      text,
  file_name      text,
  submitted_at   timestamptz not null default now(),
  is_late        boolean not null default false,
  marks_obtained numeric(6, 2) check (marks_obtained is null or marks_obtained >= 0),
  feedback       text,
  graded_by      uuid references public.profiles (id),
  graded_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (assignment_id, student_id),
  constraint submissions_has_content check (text_answer is not null or file_path is not null)
);

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

create index submissions_assignment_idx on public.submissions (assignment_id);
create index submissions_student_idx on public.submissions (student_id);

-- -----------------------------------------------------------------------------
-- Quizzes
-- -----------------------------------------------------------------------------
create table public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references public.courses (id) on delete cascade,
  created_by         uuid not null references public.profiles (id),
  title              text not null check (char_length(title) between 1 and 200),
  description        text,
  time_limit_minutes int not null check (time_limit_minutes between 1 and 600),
  opens_at           timestamptz not null,
  closes_at          timestamptz not null,
  is_published       boolean not null default false,
  shuffle_questions  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint quizzes_window check (closes_at > opens_at)
);

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

create index quizzes_course_opens_idx on public.quizzes (course_id, opens_at);

create table public.quiz_questions (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  position   int not null check (position >= 0),
  type       public.question_type not null,
  prompt     text not null,
  options    jsonb not null check (jsonb_typeof(options) = 'array'), -- [{"id":"a","text":"..."}]
  marks      numeric(5, 2) not null default 1 check (marks > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, position)
);

create trigger quiz_questions_set_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

-- Answer keys live in their own table so RLS can hide them from students entirely.
create table public.quiz_answers (
  question_id        uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_ids text[] not null check (cardinality(correct_option_ids) >= 1),
  created_at         timestamptz not null default now()
);

create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  started_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  question_order uuid[] not null default '{}',
  answers        jsonb not null default '{}'::jsonb, -- {question_id: [option_ids]}
  score          numeric(6, 2) check (score is null or score >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (quiz_id, student_id) -- one attempt per student
);

create trigger quiz_attempts_set_updated_at
  before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);
create index quiz_attempts_student_idx on public.quiz_attempts (student_id);
