-- Leadnex: database-opzet voor Supabase.
-- Plak dit in Supabase → SQL Editor → New query, en klik op Run.

create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

-- Iedere gebruiker ziet en wijzigt alleen zijn eigen gegevens.
alter table public.docs enable row level security;

drop policy if exists "Eigen gegevens lezen" on public.docs;
drop policy if exists "Eigen gegevens toevoegen" on public.docs;
drop policy if exists "Eigen gegevens wijzigen" on public.docs;
drop policy if exists "Eigen gegevens verwijderen" on public.docs;

create policy "Eigen gegevens lezen" on public.docs
  for select to authenticated using (user_id = auth.uid());
create policy "Eigen gegevens toevoegen" on public.docs
  for insert to authenticated with check (user_id = auth.uid());
create policy "Eigen gegevens wijzigen" on public.docs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Eigen gegevens verwijderen" on public.docs
  for delete to authenticated using (user_id = auth.uid());

-- Live bijwerken tussen telefoon en computer.
do $$
begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null;
end $$;
