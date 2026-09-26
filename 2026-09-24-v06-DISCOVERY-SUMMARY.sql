-- Collect TCG Production 2026-09-24-v06
-- Phase 2: owner-only discovery-source summary for accumulated Qualified Views.
-- Requires 2026-09-24-v05-DISCOVERY-ATTRIBUTION.sql to have been applied first.
-- Rerunnable: replaces the read-only summary RPC safely.

create or replace function public.get_card_discovery_summary(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  discovery_source text,
  qualified_views bigint,
  unique_visitors bigint,
  unique_cards bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_app_owner(), false) then
    raise exception 'owner access required';
  end if;

  return query
  select
    d.discovery_source,
    count(*)::bigint as qualified_views,
    count(distinct d.visitor_id)::bigint as unique_visitors,
    count(distinct d.card_id)::bigint as unique_cards
  from public.card_discovery_views d
  where d.viewed_at >= p_start
    and d.viewed_at <= p_end
  group by d.discovery_source
  order by
    count(distinct d.visitor_id) desc,
    count(*) desc,
    d.discovery_source asc;
end;
$$;

revoke all on function public.get_card_discovery_summary(timestamptz, timestamptz) from public;
revoke all on function public.get_card_discovery_summary(timestamptz, timestamptz) from anon;
grant execute on function public.get_card_discovery_summary(timestamptz, timestamptz) to authenticated;

comment on function public.get_card_discovery_summary(timestamptz, timestamptz) is
  'Owner-only aggregate summary of Qualified Card View discovery sources.';
