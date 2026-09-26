-- Collect TCG Beta v10: optional public language breakdown for mixed-language lots.
-- Safe to run once in Supabase SQL Editor. Existing RLS policies remain unchanged.

alter table public.cards
  add column if not exists language_details text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_language_details_length_check'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
      add constraint cards_language_details_length_check
      check (language_details is null or char_length(language_details) <= 120);
  end if;
end $$;
