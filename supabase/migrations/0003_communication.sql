-- =============================================================================
-- 0003_communication.sql
-- Announcements (+ read receipts), classroom chat, complaints, in-app
-- notifications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Announcements (course_id null = global, admin only)
-- -----------------------------------------------------------------------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid references public.courses (id) on delete cascade,
  author_id  uuid not null references public.profiles (id),
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null check (char_length(body) between 1 and 10000),
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create index announcements_course_created_idx on public.announcements (course_id, created_at desc);
create index announcements_pinned_created_idx on public.announcements (is_pinned desc, created_at desc);

create table public.announcement_reads (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index announcement_reads_announcement_idx on public.announcement_reads (announcement_id);

-- -----------------------------------------------------------------------------
-- Classroom chat (one room per course, soft delete)
-- -----------------------------------------------------------------------------
create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);

create trigger chat_messages_set_updated_at
  before update on public.chat_messages
  for each row execute function public.set_updated_at();

create index chat_messages_course_created_idx on public.chat_messages (course_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Complaints
-- -----------------------------------------------------------------------------
create table public.complaints (
  id              uuid primary key default gen_random_uuid(),
  raised_by       uuid not null references public.profiles (id),
  course_id       uuid references public.courses (id) on delete set null,
  category        text not null check (category in ('academic', 'technical', 'facility', 'conduct', 'other')),
  subject         text not null check (char_length(subject) between 3 and 200),
  description     text not null check (char_length(description) between 10 and 5000),
  attachment_path text,
  attachment_name text,
  status          public.complaint_status not null default 'open',
  admin_response  text,
  resolved_by     uuid references public.profiles (id),
  resolved_at     timestamptz,
  follow_up       text check (follow_up is null or char_length(follow_up) between 1 and 2000),
  follow_up_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger complaints_set_updated_at
  before update on public.complaints
  for each row execute function public.set_updated_at();

create index complaints_status_created_idx on public.complaints (status, created_at desc);
create index complaints_raised_by_idx on public.complaints (raised_by, created_at desc);

-- -----------------------------------------------------------------------------
-- In-app notifications (e.g. complaint status changed). Written by the API.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
