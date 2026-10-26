create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger course_teachers_updated_at before update on public.course_teachers for each row execute function public.set_updated_at();
create trigger enrollments_updated_at before update on public.enrollments for each row execute function public.set_updated_at();
create trigger assignments_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger quizzes_updated_at before update on public.quizzes for each row execute function public.set_updated_at();
create trigger quiz_questions_updated_at before update on public.quiz_questions for each row execute function public.set_updated_at();
create trigger quiz_answers_updated_at before update on public.quiz_answers for each row execute function public.set_updated_at();
create trigger chat_messages_updated_at before update on public.chat_messages for each row execute function public.set_updated_at();
drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
drop trigger if exists quiz_attempts_updated_at on public.quiz_attempts;
create trigger quiz_attempts_updated_at before update on public.quiz_attempts for each row execute function public.set_updated_at();
drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources','resources',false,26214400), ('submissions','submissions',false,26214400),
       ('complaint-attachments','complaint-attachments',false,10485760)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

alter publication supabase_realtime add table public.chat_messages;
alter table public.chat_messages replica identity full;

