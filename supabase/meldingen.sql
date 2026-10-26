-- Leadnex: meldingen op je telefoon.
-- Eenmalig uitvoeren in Supabase → SQL Editor → New query → plakken → Run,
-- nadat de Edge Function "leadnex-meldingen" er staat (zie README, kopje Meldingen).

-- 1. Logboek, zodat geen melding twee keer komt. Alleen de functie zelf kan erbij.
create table if not exists public.meldlog (
  sleutel   text        primary key,
  user_id   uuid        references auth.users (id) on delete cascade,
  verstuurd timestamptz not null default now()
);
alter table public.meldlog enable row level security;

-- 2. Elke minuut de functie aanroepen; die kijkt of er een melding moet komen.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'leadnex-meldingen',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bzmbehszdcqbrefsffmd.supabase.co/functions/v1/leadnex-meldingen',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Stoppen kan later met: select cron.unschedule('leadnex-meldingen');
