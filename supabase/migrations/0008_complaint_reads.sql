create table public.complaint_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, complaint_id)
);
alter table public.complaint_reads enable row level security;
create policy complaint_reads_self on public.complaint_reads for all to authenticated
using (user_id = auth.uid() and exists(select 1 from public.complaints c where c.id = complaint_id and c.raised_by = auth.uid()))
with check (user_id = auth.uid() and exists(select 1 from public.complaints c where c.id = complaint_id and c.raised_by = auth.uid()));
create index complaints_owner_created_idx on public.complaints (raised_by, created_at desc);
