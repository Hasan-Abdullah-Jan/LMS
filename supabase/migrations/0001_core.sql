-- =============================================================================
-- 0001_core.sql
-- Core identity & course structure: enums, profiles, courses, teacher
-- assignments, enrollments, audit log, shared trigger + authorization helpers.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'teacher', 'student');
create type public.question_type as enum ('mcq_single', 'mcq_multi', 'true_false');
create type public.complaint_status as enum ('open', 'in_review', 'resolved', 'rejected');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles: one row per auth.users row. Created only by an admin via the API.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text not null check (char_length(full_name) between 2 and 120),
  email                text not null unique check (email = lower(email)),
  role                 public.user_role not null,
  roll_no              text unique,
  is_active            boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint profiles_roll_no_students_only check (role = 'student' or roll_no is null)
);

comment on table public.profiles is 'Application profile for every Supabase Auth user (admin, teacher, student).';
comment on column public.profiles.must_change_password is 'True while the user still holds an admin-issued temporary password.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_role_name_idx on public.profiles (role, full_name);

-- -----------------------------------------------------------------------------
-- Courses (archived instead of deleted)
-- -----------------------------------------------------------------------------
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{2,16}$'),
  title       text not null check (char_length(title) between 2 and 160),
  description text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create index courses_archived_code_idx on public.courses (is_archived, code);

create table public.course_teachers (
  course_id  uuid not null references public.courses (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

create index course_teachers_teacher_idx on public.course_teachers (teacher_id);

create table public.enrollments (
  course_id   uuid not null references public.courses (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  primary key (course_id, student_id)
);

create index enrollments_student_idx on public.enrollments (student_id);

-- -----------------------------------------------------------------------------
-- Audit trail (written by the API with the service role only)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies can call them without
-- recursive RLS evaluation). Every helper is anchored on auth.uid().
-- -----------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.is_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id and p.is_active
    where e.course_id = target_course_id
      and e.student_id = auth.uid()
  )
$$;

create or replace function public.teaches(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_teachers t
    join public.profiles p on p.id = t.teacher_id and p.is_active
    where t.course_id = target_course_id
      and t.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_course_member(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or public.teaches(target_course_id)
      or public.is_enrolled(target_course_id)
$$;

-- True when the current user may see another user's profile: themselves,
-- admins, and anyone who shares at least one course with them.
create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with my_courses as (
    select course_id from public.course_teachers where teacher_id = auth.uid()
    union
    select course_id from public.enrollments where student_id = auth.uid()
  ),
  their_courses as (
    select course_id from public.course_teachers where teacher_id = target_profile_id
    union
    select course_id from public.enrollments where student_id = target_profile_id
  )
  select target_profile_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from my_courses m join their_courses t using (course_id))
$$;

revoke all on function public.auth_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_enrolled(uuid) from public, anon;
revoke all on function public.teaches(uuid) from public, anon;
revoke all on function public.is_course_member(uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;

grant execute on function
  public.auth_role(),
  public.is_admin(),
  public.is_enrolled(uuid),
  public.teaches(uuid),
  public.is_course_member(uuid),
  public.can_view_profile(uuid)
to authenticated, service_role;
