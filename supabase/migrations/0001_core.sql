create extension if not exists pgcrypto with schema extensions;
create type public.user_role as enum ('admin', 'teacher', 'student');
create type public.question_type as enum ('mcq_single', 'mcq_multi', 'true_false');
create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null,
  roll_no text unique,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  title text not null, description text, is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (course_id, teacher_id)
);
create table public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (course_id, student_id)
);
create table public.audit_log (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
  action text not null, entity text not null, entity_id uuid, at timestamptz not null default now(), created_at timestamptz not null default now()
);

create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;
create or replace function public.is_enrolled(target_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.enrollments e where e.course_id = target_course_id and e.student_id = auth.uid())
$$;
create or replace function public.teaches(target_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.course_teachers t where t.course_id = target_course_id and t.teacher_id = auth.uid())
$$;
create or replace function public.is_course_member(target_course_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_role() = 'admin' or public.teaches(target_course_id) or public.is_enrolled(target_course_id)
$$;
revoke all on function public.current_role() from public;
revoke all on function public.is_enrolled(uuid) from public;
revoke all on function public.teaches(uuid) from public;
revoke all on function public.is_course_member(uuid) from public;
grant execute on function public.current_role(), public.is_enrolled(uuid), public.teaches(uuid), public.is_course_member(uuid) to authenticated;

create index courses_active_idx on public.courses (is_archived, title);
create index course_teachers_teacher_idx on public.course_teachers (teacher_id);
create index enrollments_student_idx on public.enrollments (student_id);
create index audit_log_at_idx on public.audit_log (at desc);

