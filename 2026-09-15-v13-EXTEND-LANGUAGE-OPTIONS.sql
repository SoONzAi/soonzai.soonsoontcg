-- Collect TCG Beta v13: permit the Language options used by the owner form.
-- Run once in Supabase SQL Editor. Existing card data and RLS policies are retained.

do $$
declare
  constraint_row record;
begin
  -- Replace only the existing CHECK constraint that applies to the `language`
  -- column. This deliberately does not touch `language_details` constraints.
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.cards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '(^|[^a-z_])language([^a-z_]|$)'
  loop
    execute format('alter table public.cards drop constraint %I', constraint_row.conname);
  end loop;

  alter table public.cards
    add constraint cards_language_check
    check (
      language is null
      or language in ('', 'JP', 'ENG', 'KR', 'CN', 'Mixed / Multiple languages', 'N/A')
    );
end $$;

notify pgrst, 'reload schema';
