-- Leadnex: opslag voor foto's en bestanden bij bedrijven, en voor de automatische back-up.
-- Eenmalig uitvoeren in Supabase → SQL Editor → New query → plakken → Run.
-- Iedere gebruiker ziet alleen zijn eigen bestanden: alles staat in een map met zijn eigen gebruikers-id.

-- 1. Twee afgeschermde opslagplekken (niet openbaar).
--    bestanden: foto's en bestanden, hooguit 25 MB per bestand.
--    backups:   elke nacht een back-up van je gegevens; alleen de functie leadnex-meldingen schrijft hierin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('bestanden', 'bestanden', false, 26214400),
       ('backups', 'backups', false, 52428800)
on conflict (id) do nothing;

-- 2. Wie mag wat.
drop policy if exists "Leadnex: eigen bestanden lezen" on storage.objects;
drop policy if exists "Leadnex: eigen bestanden toevoegen" on storage.objects;
drop policy if exists "Leadnex: eigen bestanden verwijderen" on storage.objects;

create policy "Leadnex: eigen bestanden lezen" on storage.objects
  for select to authenticated
  using (bucket_id in ('bestanden', 'backups') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Leadnex: eigen bestanden toevoegen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bestanden' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Leadnex: eigen bestanden verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bestanden' and (storage.foldername(name))[1] = auth.uid()::text);
