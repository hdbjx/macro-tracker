-- The partial unique index on foods(source, source_id) can't be used by
-- INSERT ... ON CONFLICT (source, source_id), so caching USDA results failed.
-- A plain unique constraint works; NULL source_ids (user foods) never collide.

drop index if exists public.foods_source_unique;
alter table public.foods
  add constraint foods_source_unique unique (source, source_id);
