/*
# Auto-create profile on signup + Analytics view

## Changes
1. `handle_new_user()` trigger function — when a new auth.user is created,
   automatically inserts a matching row in `public.profiles` with role='employee'
   using the email and full_name from user metadata.
2. Trigger `on_auth_user_created` fires AFTER INSERT on auth.users.
3. `analytics_department_distribution` view — department-wise employee counts.
4. Grant select on the analytics view to authenticated users.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.handle_new_user() to authenticated;

-- Analytics view: department distribution
create or replace view public.analytics_department_distribution as
select
  d.id as department_id,
  d.name as department_name,
  count(e.id) as employee_count
from public.departments d
left join public.employees e on e.department_id = d.id
group by d.id, d.name;

grant select on public.analytics_department_distribution to authenticated;
