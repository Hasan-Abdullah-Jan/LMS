create policy profiles_read_course_members on public.profiles for select to authenticated
using (
  exists (select 1 from public.course_teachers t where t.teacher_id = profiles.id and public.is_enrolled(t.course_id)) or
  exists (select 1 from public.enrollments e where e.student_id = profiles.id and public.is_enrolled(e.course_id))
);

create or replace function public.guard_chat_message_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.course_id is distinct from old.course_id or
     new.sender_id is distinct from old.sender_id or new.body is distinct from old.body or
     new.created_at is distinct from old.created_at then
    raise exception 'chat messages are immutable';
  end if;
  return new;
end $$;
create trigger guard_chat_message_update before update on public.chat_messages
for each row execute function public.guard_chat_message_update();

alter publication supabase_realtime add table public.announcements;
