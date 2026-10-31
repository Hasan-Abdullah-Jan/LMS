-- =============================================================================
-- 0007_storage_realtime.sql
-- Private storage buckets and Realtime publication.
--
-- Buckets are private and have NO storage.objects policies for the
-- "authenticated" role: browsers can never list, read or write objects
-- directly. The API authorizes every request, then uploads with the service
-- role and hands out 60-second signed URLs for downloads.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'resources', 'resources', false, 26214400,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp'
    ]
  ),
  (
    'submissions', 'submissions', false, 26214400,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp'
    ]
  ),
  (
    'complaint-attachments', 'complaint-attachments', false, 10485760,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp'
    ]
  )
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Realtime: chat, announcement badges and personal notifications.
-- Delivery is filtered by each table's SELECT policy (RLS).
-- -----------------------------------------------------------------------------
alter table public.chat_messages replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['chat_messages', 'announcements', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
