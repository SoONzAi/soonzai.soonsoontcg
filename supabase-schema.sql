-- ==============================================================================
-- SoonSoonTCG - Complete Database Schema & Supabase Setup
-- Run this entire script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create 'cards' table
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  card_code text default '',
  year text default '',
  game text not null default 'Pokémon',
  language text default 'EN',
  language_details text,
  era text default '',
  availability text not null default 'Available',
  set_name text default '',
  series text default '',
  format text default 'Standard',
  rarity text default 'Common',
  condition text default 'NM',
  quantity integer not null default 1,
  price numeric,
  price_usd numeric,
  price_myr numeric,
  price_sgd numeric,
  cost numeric,
  notes text default '',
  images text[] default '{}'::text[],
  thumbnail_url text default '',
  grading jsonb default '[]'::jsonb,
  grading_private jsonb default '[]'::jsonb,
  view_count integer default 0,
  sold_at timestamptz,
  lifecycle_status text not null default 'live',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create 'card_owner_private' table (for private cost/notes)
create table if not exists public.card_owner_private (
  card_id uuid primary key references public.cards(id) on delete cascade,
  cost numeric,
  notes text default '',
  private_tags text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create 'card_image_variants' table (for watermarked/clean variants)
create table if not exists public.card_image_variants (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade,
  image_key text not null,
  clean_url text,
  watermarked_url text,
  has_watermark boolean default false,
  created_at timestamptz not null default now()
);

-- 5. Create 'card_edit_history' table
create table if not exists public.card_edit_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade,
  action text not null,
  diff jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. Create 'giveaways' table
create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  image_url text default '',
  winner_name text default '',
  winner_profile_url text default '',
  gave_away_date date,
  is_past_winner boolean default false,
  is_hidden boolean default false,
  giveaway_code text default '',
  entry_form_url text default '',
  facebook_post_url text default '',
  instagram_post_url text default '',
  require_facebook boolean default true,
  require_instagram boolean default true,
  require_comment boolean default true,
  require_website_code boolean default true,
  bonus_facebook_group boolean default false,
  bonus_share_facebook boolean default false,
  bonus_tag_friends boolean default false,
  bonus_share_instagram_story boolean default false,
  winner_announced_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. Create 'showcases' table
create table if not exists public.showcases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'Collection Showcase',
  series text default '',
  video_url text not null,
  thumbnail_url text default '',
  description text default '',
  sort_order integer default 0,
  is_featured boolean default false,
  created_at timestamptz not null default now()
);

-- 8. Owner Authentication Check Function
create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.role() = 'authenticated');
$$;

grant execute on function public.is_app_owner() to anon, authenticated;

-- 9. Get Owner Cards RPC
create or replace function public.get_owner_cards()
returns setof public.cards
language sql
stable
security definer
set search_path = public
as $$
  select * from public.cards order by created_at asc;
$$;

grant execute on function public.get_owner_cards() to authenticated;

-- 10. Get Public SEO Cards RPC
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

grant execute on function public.get_public_seo_cards() to anon, authenticated;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.cards enable row level security;
alter table public.card_owner_private enable row level security;
alter table public.card_image_variants enable row level security;
alter table public.card_edit_history enable row level security;
alter table public.giveaways enable row level security;
alter table public.showcases enable row level security;

-- Cards RLS: Public can read live cards; Authenticated owner can do everything
drop policy if exists "Public cards are readable by everyone" on public.cards;
create policy "Public cards are readable by everyone"
  on public.cards for select
  using (true);

drop policy if exists "Authenticated owner can insert cards" on public.cards;
create policy "Authenticated owner can insert cards"
  on public.cards for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated owner can update cards" on public.cards;
create policy "Authenticated owner can update cards"
  on public.cards for update
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated owner can delete cards" on public.cards;
create policy "Authenticated owner can delete cards"
  on public.cards for delete
  using (auth.role() = 'authenticated');

-- Private data: Owner only
drop policy if exists "Owner can manage private card meta" on public.card_owner_private;
create policy "Owner can manage private card meta"
  on public.card_owner_private for all
  using (auth.role() = 'authenticated');

drop policy if exists "Owner can manage image variants" on public.card_image_variants;
create policy "Owner can manage image variants"
  on public.card_image_variants for all
  using (auth.role() = 'authenticated');

drop policy if exists "Owner can manage edit history" on public.card_edit_history;
create policy "Owner can manage edit history"
  on public.card_edit_history for all
  using (auth.role() = 'authenticated');

-- Giveaways: Public read, owner manage
drop policy if exists "Public can view giveaways" on public.giveaways;
create policy "Public can view giveaways"
  on public.giveaways for select
  using (true);

drop policy if exists "Owner can manage giveaways" on public.giveaways;
create policy "Owner can manage giveaways"
  on public.giveaways for all
  using (auth.role() = 'authenticated');

-- Showcases: Public read, owner manage
drop policy if exists "Public can view showcases" on public.showcases;
create policy "Public can view showcases"
  on public.showcases for select
  using (true);

drop policy if exists "Owner can manage showcases" on public.showcases;
create policy "Owner can manage showcases"
  on public.showcases for all
  using (auth.role() = 'authenticated');

-- ==============================================================================
-- 12. STORAGE BUCKET CONFIGURATION (card-images)
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = true;

-- Storage RLS: Public view, authenticated owner upload/delete
drop policy if exists "Public Access to Card Images" on storage.objects;
create policy "Public Access to Card Images"
  on storage.objects for select
  using (bucket_id = 'card-images');

drop policy if exists "Owner can upload card images" on storage.objects;
create policy "Owner can upload card images"
  on storage.objects for insert
  with check (bucket_id = 'card-images' and auth.role() = 'authenticated');

drop policy if exists "Owner can update card images" on storage.objects;
create policy "Owner can update card images"
  on storage.objects for update
  using (bucket_id = 'card-images' and auth.role() = 'authenticated');

drop policy if exists "Owner can delete card images" on storage.objects;
create policy "Owner can delete card images"
  on storage.objects for delete
  using (bucket_id = 'card-images' and auth.role() = 'authenticated');
