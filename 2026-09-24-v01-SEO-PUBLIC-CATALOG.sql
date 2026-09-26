-- Collect TCG Production 2026-09-24-v01
-- Read-only public SEO catalogue RPC for static card-page generation.
-- This does not grant direct SELECT on public.cards and does not change RLS.
-- Rerunnable: CREATE OR REPLACE + idempotent grants.

create or replace function public.get_public_seo_cards()
returns table (
  id text,
  name text,
  card_code text,
  year text,
  game text,
  language text,
  era text,
  availability text,
  set_name text,
  series text,
  format text,
  rarity text,
  condition text,
  price text,
  price_usd text,
  price_myr text,
  price_sgd text,
  thumbnail_url text,
  grading jsonb,
  created_at text,
  updated_at text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id::text,
    c.name::text,
    c.card_code::text,
    c.year::text,
    c.game::text,
    c.language::text,
    c.era::text,
    c.availability::text,
    c.set_name::text,
    c.series::text,
    c.format::text,
    c.rarity::text,
    c.condition::text,
    c.price::text,
    c.price_usd::text,
    c.price_myr::text,
    c.price_sgd::text,
    c.thumbnail_url::text,
    coalesce(c.grading, '[]'::jsonb)::jsonb,
    c.created_at::text,
    c.updated_at::text
  from public.cards c
  where coalesce(c.lifecycle_status::text,'live') = 'live'
    and coalesce(c.availability::text,'Available') in (
      'Available',
      'Reserved',
      'Sold',
      'Collection (NFS)'
    )
  order by c.created_at asc nulls last, c.id asc;
$$;

revoke all on function public.get_public_seo_cards() from public;
grant execute on function public.get_public_seo_cards() to anon;
grant execute on function public.get_public_seo_cards() to authenticated;
