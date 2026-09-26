-- Collect TCG Beta 2026-09-17-v18
-- Owner-only Country -> Card demand aggregation for Insights.
-- Safe to rerun. Does not expose visitor identifiers and does not change RLS.

begin;

create index if not exists site_visit_country_events_visitor_created_idx
  on public.site_visit_country_events(visitor_id, created_at desc);

drop function if exists public.get_country_card_view_insights(timestamptz,timestamptz);

create function public.get_country_card_view_insights(
  p_start timestamptz,
  p_end timestamptz
)
returns table(
  country_code text,
  card_id text,
  views bigint,
  unique_views bigint
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'owner access required' using errcode='42501';
  end if;

  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'invalid date range';
  end if;

  return query
  with attributed as (
    select
      q.card_id,
      q.visitor_id,
      coalesce(country_event.country_code,'XX') as country_code
    from public.qualified_card_view_events q
    left join lateral (
      select c.country_code
      from public.site_visit_country_events c
      where c.visitor_id=q.visitor_id
        -- Country is recorded once per visit session. Match the closest
        -- country event around the qualified card view without retaining or
        -- returning an individual browsing history.
        and c.created_at >= q.created_at - interval '24 hours'
        and c.created_at <= q.created_at + interval '30 minutes'
      order by
        abs(extract(epoch from (c.created_at-q.created_at))) asc,
        c.created_at desc
      limit 1
    ) country_event on true
    where q.created_at >= p_start
      and q.created_at <= p_end
  )
  select
    a.country_code,
    a.card_id,
    count(*)::bigint as views,
    count(distinct a.visitor_id)::bigint as unique_views
  from attributed a
  group by a.country_code,a.card_id
  order by count(*) desc,a.country_code asc,a.card_id asc;
end;
$$;

revoke all on function public.get_country_card_view_insights(timestamptz,timestamptz) from public;
revoke all on function public.get_country_card_view_insights(timestamptz,timestamptz) from anon;
revoke all on function public.get_country_card_view_insights(timestamptz,timestamptz) from authenticated;
grant execute on function public.get_country_card_view_insights(timestamptz,timestamptz) to authenticated;

commit;
