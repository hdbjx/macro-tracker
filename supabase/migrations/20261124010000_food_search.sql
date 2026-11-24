-- Food search support: Open Food Facts as a (crowdsourced, unverified) barcode fallback,
-- and a cache of USDA queries so repeat searches don't burn the USDA rate limit.

alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check
  check (source in ('usda','fatsecret','openfoodfacts','curated','user'));

create table if not exists public.usda_query_cache (
  q           text primary key,          -- normalized query
  source_ids  text[] not null,           -- fdcIds in USDA's ranking order
  fetched_at  timestamptz not null default now()
);

-- Server-only table: RLS on with no policies means clients can't read or write it.
alter table public.usda_query_cache enable row level security;
