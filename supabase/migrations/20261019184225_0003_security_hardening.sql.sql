/*
# Security hardening — address Supabase advisor findings

## Changes
1. Revoke EXECUTE on all SECURITY DEFINER helper/trigger functions from the
   `anon` role (and `authenticated` where they are not meant as direct RPCs)
   so they are not callable as public RPC endpoints via /rest/v1/rpc/. The
   functions are still used internally by RLS policies and triggers.
2. Pin `search_path = public` on `touch_updated_at` (mutable search_path WARN).
3. Recreate `analytics_department_distribution` as SECURITY INVOKER so it honors
   the caller's RLS policies instead of the view owner's privileges (ERROR).
*/

-- 1. Revoke EXECUTE from anon on all SECURITY DEFINER functions.
revoke execute on function public.approve_leave_request(uuid, text, text) from anon, authenticated;
revoke execute on function public.user_role() from anon, authenticated;
revoke execute on function public.has_role(text[]) from anon, authenticated;
revoke execute on function public.managed_department() from anon, authenticated;
revoke execute on function public.is_manager_of(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Re-grant EXECUTE ONLY to authenticated for approve_leave_request (the one
-- function genuinely meant to be called by signed-in users via RPC).
grant execute on function public.approve_leave_request(uuid, text, text) to authenticated;

-- 2. Pin search_path on touch_updated_at trigger function.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Recreate the analytics view as SECURITY INVOKER so it respects the
--    caller's RLS policies on the underlying tables.
drop view if exists public.analytics_department_distribution;

create or replace view public.analytics_department_distribution
with (security_invoker = true)
as
select
  d.id as department_id,
  d.name as department_name,
  count(e.id) as employee_count
from public.departments d
left join public.employees e on e.department_id = d.id
group by d.id, d.name;

alter view public.analytics_department_distribution set (security_invoker = true);
grant select on public.analytics_department_distribution to authenticated;
