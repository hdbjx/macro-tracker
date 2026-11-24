-- =============================================================
-- Macro tracker — initial schema
-- Paste into Supabase SQL Editor and run once on a fresh project.
-- =============================================================

create extension if not exists pg_trgm with schema extensions;

-- -------------------------------------------------------------
-- PROFILES (one row per user, auto-created on signup)
-- -------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  sex            text check (sex in ('male','female')),
  birth_year     int  check (birth_year between 1900 and 2100),
  height_cm      numeric(5,1) check (height_cm > 0),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal           text check (goal in ('lose','maintain','gain')),
  goal_rate_kg_per_week numeric(4,2),          -- e.g. -0.5 for losing ~1 lb/wk
  units          text not null default 'imperial' check (units in ('imperial','metric')),
  onboarded      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- FOODS
--   owner_id NULL  = shared food (USDA / FatSecret / our verified entries).
--                    Only the server (service role) writes these.
--   owner_id = uid = a user's private custom food. Never shared.
-- All nutrition values are per ONE base serving (serving_label / serving_grams).
-- -------------------------------------------------------------
create table public.foods (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users(id) on delete cascade,
  source         text not null check (source in ('usda','fatsecret','curated','user')),
  source_id      text,                          -- id in the external database
  barcode        text,                          -- UPC/EAN, digits only
  name           text not null,
  brand          text,
  serving_label  text not null default '100 g', -- e.g. '1 bar', '1 cup'
  serving_grams  numeric(8,2),                  -- grams in that serving, if known
  calories       numeric(8,1) not null check (calories >= 0),
  protein_g      numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g        numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g          numeric(7,2) not null default 0 check (fat_g >= 0),
  fiber_g        numeric(7,2),
  sugar_g        numeric(7,2),
  sodium_mg      numeric(8,1),
  verified       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint user_foods_are_private check ((source = 'user') = (owner_id is not null))
);

create unique index foods_source_unique   on public.foods (source, source_id) where source_id is not null;
create index foods_barcode_idx            on public.foods (barcode) where barcode is not null;
create index foods_owner_idx              on public.foods (owner_id) where owner_id is not null;
create index foods_name_trgm_idx          on public.foods using gin (name extensions.gin_trgm_ops);
create index foods_brand_trgm_idx         on public.foods using gin (brand extensions.gin_trgm_ops);

-- Extra serving sizes per food (1 cup = 240 g, 1 slice = 28 g, ...)
create table public.food_servings (
  id        uuid primary key default gen_random_uuid(),
  food_id   uuid not null references public.foods(id) on delete cascade,
  label     text not null,
  grams     numeric(8,2) not null check (grams > 0),
  unique (food_id, label)
);

-- -------------------------------------------------------------
-- FOOD LOGS
--   Macros are snapshotted at log time so editing/deleting a food
--   never rewrites someone's history.
--   food_id may be NULL for quick-adds ("350 cal, 30p").
-- -------------------------------------------------------------
create table public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  food_id     uuid references public.foods(id) on delete set null,
  serving_id  uuid references public.food_servings(id) on delete set null,
  logged_on   date not null,                    -- the user's local calendar day
  meal        text not null check (meal in ('breakfast','lunch','dinner','snack')),
  quantity    numeric(7,2) not null default 1 check (quantity > 0),
  name        text not null,                    -- snapshot of food name
  calories    numeric(8,1) not null check (calories >= 0),
  protein_g   numeric(7,2) not null default 0,
  carbs_g     numeric(7,2) not null default 0,
  fat_g       numeric(7,2) not null default 0,
  method      text not null default 'search'
              check (method in ('search','barcode','recent','quick_add','ai_text','ai_photo','copy')),
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index food_logs_user_day_idx  on public.food_logs (user_id, logged_on);
create index food_logs_user_food_idx on public.food_logs (user_id, food_id, logged_at desc);

-- -------------------------------------------------------------
-- WEIGHT ENTRIES (one per day; latest write wins)
-- -------------------------------------------------------------
create table public.weight_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5,2) not null check (weight_kg between 20 and 400),
  created_at   timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- -------------------------------------------------------------
-- TARGETS (history of daily targets; the row with the latest
-- effective_from <= today is the active one)
-- -------------------------------------------------------------
create table public.targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  effective_from  date not null,
  calories        int  not null check (calories between 800 and 8000),
  protein_g       int  not null check (protein_g >= 0),
  carbs_g         int  not null check (carbs_g >= 0),
  fat_g           int  not null check (fat_g >= 0),
  mode            text not null default 'manual' check (mode in ('manual','adaptive')),
  est_tdee        int,                          -- what the adaptive engine estimated
  created_at      timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- -------------------------------------------------------------
-- AI USAGE (daily cap on AI text/photo logging)
-- -------------------------------------------------------------
create table public.ai_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  used_on  date not null,
  count    int  not null default 0,
  primary key (user_id, used_on)
);

-- Called by the AI edge function with the user's JWT.
-- Returns true and counts the call if under the cap, false otherwise.
create or replace function public.consume_ai_credit(day date, cap int default 15)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_count int;
begin
  if uid is null then
    return false;
  end if;

  insert into public.ai_usage (user_id, used_on, count)
  values (uid, day, 1)
  on conflict (user_id, used_on)
  do update set count = public.ai_usage.count + 1
  where public.ai_usage.count < cap
  returning count into new_count;

  return new_count is not null;
end;
$$;

revoke all on function public.consume_ai_credit(date, int) from public, anon;
grant execute on function public.consume_ai_credit(date, int) to authenticated;

-- -------------------------------------------------------------
-- updated_at triggers
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger foods_touch before update on public.foods
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- VIEWS & HELPERS (run as the calling user, so RLS applies)
-- -------------------------------------------------------------
create view public.daily_totals
with (security_invoker = true) as
select
  user_id,
  logged_on,
  sum(calories)  as calories,
  sum(protein_g) as protein_g,
  sum(carbs_g)   as carbs_g,
  sum(fat_g)     as fat_g,
  count(*)       as entries
from public.food_logs
group by user_id, logged_on;

-- Foods this user logs most, for the one-tap "recents" list.
create or replace function public.recent_foods(limit_n int default 20)
returns table (
  food_id         uuid,
  name            text,
  brand           text,
  serving_label   text,
  calories        numeric,
  last_quantity   numeric,
  last_serving_id uuid,
  last_meal       text,
  times_logged    bigint,
  last_logged     timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.id, f.name, f.brand, f.serving_label, f.calories,
    (array_agg(l.quantity   order by l.logged_at desc))[1],
    (array_agg(l.serving_id order by l.logged_at desc))[1],
    (array_agg(l.meal       order by l.logged_at desc))[1],
    count(*),
    max(l.logged_at)
  from public.food_logs l
  join public.foods f on f.id = l.food_id
  where l.user_id = auth.uid()
    and l.logged_at > now() - interval '60 days'
  group by f.id, f.name, f.brand, f.serving_label, f.calories
  order by count(*) desc, max(l.logged_at) desc
  limit limit_n;
$$;

-- Fuzzy food search across shared foods + the user's own foods.
create or replace function public.search_foods(q text, limit_n int default 30)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = '0.45'    -- forgiving enough for 'chiken'
as $$
  select f.*
  from public.foods f
  where (f.owner_id is null or f.owner_id = auth.uid())
    and (
      q operator(extensions.<%) f.name                -- typo-tolerant word match
      or q operator(extensions.<%) coalesce(f.brand, '')
      or f.name ilike '%' || q || '%'
    )
  order by
    (f.owner_id = auth.uid()) desc nulls last,  -- user's own foods first
    f.verified desc,
    extensions.word_similarity(q, coalesce(f.brand,'') || ' ' || f.name) desc
  limit limit_n;
$$;

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.foods          enable row level security;
alter table public.food_servings  enable row level security;
alter table public.food_logs      enable row level security;
alter table public.weight_entries enable row level security;
alter table public.targets        enable row level security;
alter table public.ai_usage       enable row level security;

-- profiles: own row only
create policy "profiles: read own"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- foods: read shared + own; write only own custom foods
create policy "foods: read shared and own" on public.foods for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy "foods: insert own" on public.foods for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'user' and verified = false);
create policy "foods: update own" on public.foods for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and source = 'user' and verified = false);
create policy "foods: delete own" on public.foods for delete to authenticated
  using (owner_id = (select auth.uid()));

-- food_servings: follow the parent food
create policy "servings: read" on public.food_servings for select to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id
                 and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy "servings: write own" on public.food_servings for all to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())));

-- logs / weights / targets: full control of own rows only
create policy "logs: own"    on public.food_logs      for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "weights: own" on public.weight_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "targets: own" on public.targets        for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ai_usage: read own count (writes only via consume_ai_credit)
create policy "ai_usage: read own" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
