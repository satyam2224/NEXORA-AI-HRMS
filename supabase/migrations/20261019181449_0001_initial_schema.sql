/*
# NEXORA AI HRMS — Initial Schema

## Purpose
Core database schema for the NEXORA AI Human Resource Management System.

## Tables
1. `profiles` — extends auth.users with role, full name, avatar
2. `departments` — company departments
3. `employees` — employee records
4. `attendance` — daily check-in/check-out records
5. `leave_types` — types of leave
6. `leave_requests` — employee leave applications
7. `leave_balances` — per-employee yearly leave balances
8. `payroll_records` — monthly salary/earnings/deductions
9. `notifications` — in-app notifications
10. `hr_documents` — knowledge documents for AI RAG

## Roles (stored in profiles.role)
- admin, hr_manager, dept_manager, employee

## Security
- RLS enabled on every table.
- Helper functions enforce role + ownership checks.
- Payroll: employees see only their own; managers do NOT see salary.
- Leave: employees cannot approve their own requests (enforced server-side).

## Notes
- Idempotent. Uses IF NOT EXISTS and DROP POLICY IF EXISTS.
*/

-- ===========================================================================
-- TABLES
-- ===========================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'employee'
    check (role in ('admin','hr_manager','dept_manager','employee')),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  employee_code text unique not null,
  department_id uuid references public.departments(id) on delete set null,
  job_title text,
  employment_status text not null default 'active'
    check (employment_status in ('active','inactive','terminated','on_leave')),
  is_manager boolean not null default false,
  hire_date date not null default current_date,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists employees_profile_idx on public.employees(profile_id);
create index if not exists employees_status_idx on public.employees(employment_status);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  check_in timestamptz not null,
  check_out timestamptz,
  status text not null default 'present'
    check (status in ('present','late','absent','half_day','leave')),
  notes text,
  created_at timestamptz not null default now(),
  constraint attendance_checkout_after_checkin check (check_out is null or check_out > check_in)
);

create index if not exists attendance_employee_date_idx on public.attendance(employee_id, check_in);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_balance integer not null default 12,
  is_paid boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  days numeric(5,2) not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  approver_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approver_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_date_order check (end_date >= start_date)
);

create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);
create index if not exists leave_requests_status_idx on public.leave_requests(status);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  year integer not null default extract(year from now())::int,
  balance numeric(5,2) not null default 0,
  used numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_period_month integer not null check (pay_period_month between 1 and 12),
  pay_period_year integer not null,
  base_salary numeric(12,2) not null default 0,
  earnings numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  net_pay numeric(12,2) generated always as (base_salary + earnings - deductions - tax) stored,
  status text not null default 'draft'
    check (status in ('draft','approved','paid')),
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, pay_period_month, pay_period_year)
);

create index if not exists payroll_employee_idx on public.payroll_records(employee_id);
create index if not exists payroll_period_idx on public.payroll_records(pay_period_year, pay_period_month);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read);

create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'policy',
  content text not null,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- HELPER FUNCTIONS
-- ===========================================================================

create or replace function public.user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.user_role() = any(allowed_roles), false);
$$;

create or replace function public.managed_department()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select e.department_id
  from public.employees e
  where e.profile_id = auth.uid()
    and e.is_manager = true
  limit 1;
$$;

create or replace function public.is_manager_of(emp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.employees managed
    where managed.profile_id = emp
      and managed.department_id = public.managed_department()
  );
$$;

-- ===========================================================================
-- RLS ENABLE + POLICIES
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.payroll_records enable row level security;
alter table public.notifications enable row level security;
alter table public.hr_documents enable row level security;

-- profiles
drop policy if exists "profiles_select_authorized" on public.profiles;
create policy "profiles_select_authorized"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.has_role(array['admin','hr_manager'])
  or public.is_manager_of(id)
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_authorized" on public.profiles;
create policy "profiles_update_authorized"
on public.profiles for update to authenticated
using (id = auth.uid() or public.has_role(array['admin']))
with check (id = auth.uid() or public.has_role(array['admin']));

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
on public.profiles for delete to authenticated
using (public.has_role(array['admin']));

-- departments
drop policy if exists "departments_select_all" on public.departments;
create policy "departments_select_all"
on public.departments for select to authenticated using (true);

drop policy if exists "departments_insert_staff" on public.departments;
create policy "departments_insert_staff"
on public.departments for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "departments_update_staff" on public.departments;
create policy "departments_update_staff"
on public.departments for update to authenticated
using (public.has_role(array['admin','hr_manager']))
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "departments_delete_staff" on public.departments;
create policy "departments_delete_staff"
on public.departments for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- employees
drop policy if exists "employees_select_authorized" on public.employees;
create policy "employees_select_authorized"
on public.employees for select to authenticated
using (
  profile_id = auth.uid()
  or public.has_role(array['admin','hr_manager'])
  or public.is_manager_of(profile_id)
);

drop policy if exists "employees_insert_staff" on public.employees;
create policy "employees_insert_staff"
on public.employees for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "employees_update_authorized" on public.employees;
create policy "employees_update_authorized"
on public.employees for update to authenticated
using (
  profile_id = auth.uid()
  or public.has_role(array['admin','hr_manager'])
  or public.is_manager_of(profile_id)
)
with check (
  profile_id = auth.uid()
  or public.has_role(array['admin','hr_manager'])
  or public.is_manager_of(profile_id)
);

drop policy if exists "employees_delete_staff" on public.employees;
create policy "employees_delete_staff"
on public.employees for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- attendance
drop policy if exists "attendance_select_authorized" on public.attendance;
create policy "attendance_select_authorized"
on public.attendance for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = attendance.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
);

drop policy if exists "attendance_insert_authorized" on public.attendance;
create policy "attendance_insert_authorized"
on public.attendance for insert to authenticated
with check (
  exists (
    select 1 from public.employees e
    where e.id = attendance.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
      )
  )
);

drop policy if exists "attendance_update_authorized" on public.attendance;
create policy "attendance_update_authorized"
on public.attendance for update to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = attendance.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = attendance.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
      )
  )
);

drop policy if exists "attendance_delete_staff" on public.attendance;
create policy "attendance_delete_staff"
on public.attendance for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- leave_types
drop policy if exists "leave_types_select_all" on public.leave_types;
create policy "leave_types_select_all"
on public.leave_types for select to authenticated using (true);

drop policy if exists "leave_types_insert_staff" on public.leave_types;
create policy "leave_types_insert_staff"
on public.leave_types for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "leave_types_update_staff" on public.leave_types;
create policy "leave_types_update_staff"
on public.leave_types for update to authenticated
using (public.has_role(array['admin','hr_manager']))
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "leave_types_delete_staff" on public.leave_types;
create policy "leave_types_delete_staff"
on public.leave_types for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- leave_requests
drop policy if exists "leave_requests_select_authorized" on public.leave_requests;
create policy "leave_requests_select_authorized"
on public.leave_requests for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
);

drop policy if exists "leave_requests_insert_self" on public.leave_requests;
create policy "leave_requests_insert_self"
on public.leave_requests for insert to authenticated
with check (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and e.profile_id = auth.uid()
  )
);

drop policy if exists "leave_requests_update_authorized" on public.leave_requests;
create policy "leave_requests_update_authorized"
on public.leave_requests for update to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and (
        (e.profile_id = auth.uid() and leave_requests.status in ('pending','cancelled'))
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
);

drop policy if exists "leave_requests_delete_authorized" on public.leave_requests;
create policy "leave_requests_delete_authorized"
on public.leave_requests for delete to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and (
        (e.profile_id = auth.uid() and leave_requests.status in ('pending','cancelled'))
        or public.has_role(array['admin','hr_manager'])
      )
  )
);

-- leave_balances
drop policy if exists "leave_balances_select_authorized" on public.leave_balances;
create policy "leave_balances_select_authorized"
on public.leave_balances for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_balances.employee_id
      and (
        e.profile_id = auth.uid()
        or public.has_role(array['admin','hr_manager'])
        or public.is_manager_of(e.profile_id)
      )
  )
);

drop policy if exists "leave_balances_insert_staff" on public.leave_balances;
create policy "leave_balances_insert_staff"
on public.leave_balances for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "leave_balances_update_staff" on public.leave_balances;
create policy "leave_balances_update_staff"
on public.leave_balances for update to authenticated
using (public.has_role(array['admin','hr_manager']))
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "leave_balances_delete_staff" on public.leave_balances;
create policy "leave_balances_delete_staff"
on public.leave_balances for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- payroll_records
drop policy if exists "payroll_select_authorized" on public.payroll_records;
create policy "payroll_select_authorized"
on public.payroll_records for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = payroll_records.employee_id
      and (
        (e.profile_id = auth.uid())
        or public.has_role(array['admin','hr_manager'])
      )
  )
);

drop policy if exists "payroll_insert_staff" on public.payroll_records;
create policy "payroll_insert_staff"
on public.payroll_records for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "payroll_update_staff" on public.payroll_records;
create policy "payroll_update_staff"
on public.payroll_records for update to authenticated
using (public.has_role(array['admin','hr_manager']))
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "payroll_delete_staff" on public.payroll_records;
create policy "payroll_delete_staff"
on public.payroll_records for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_insert_authorized" on public.notifications;
create policy "notifications_insert_authorized"
on public.notifications for insert to authenticated
with check (user_id = auth.uid() or public.has_role(array['admin','hr_manager','dept_manager']));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_authorized" on public.notifications;
create policy "notifications_delete_authorized"
on public.notifications for delete to authenticated
using (user_id = auth.uid() or public.has_role(array['admin']));

-- hr_documents
drop policy if exists "hr_documents_select_all" on public.hr_documents;
create policy "hr_documents_select_all"
on public.hr_documents for select to authenticated using (true);

drop policy if exists "hr_documents_insert_staff" on public.hr_documents;
create policy "hr_documents_insert_staff"
on public.hr_documents for insert to authenticated
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "hr_documents_update_staff" on public.hr_documents;
create policy "hr_documents_update_staff"
on public.hr_documents for update to authenticated
using (public.has_role(array['admin','hr_manager']))
with check (public.has_role(array['admin','hr_manager']));

drop policy if exists "hr_documents_delete_staff" on public.hr_documents;
create policy "hr_documents_delete_staff"
on public.hr_documents for delete to authenticated
using (public.has_role(array['admin','hr_manager']));

-- ===========================================================================
-- TRIGGERS for updated_at
-- ===========================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists employees_touch on public.employees;
create trigger employees_touch before update on public.employees
  for each row execute function public.touch_updated_at();

drop trigger if exists leave_requests_touch on public.leave_requests;
create trigger leave_requests_touch before update on public.leave_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists payroll_records_touch on public.payroll_records;
create trigger payroll_records_touch before update on public.payroll_records
  for each row execute function public.touch_updated_at();

drop trigger if exists hr_documents_touch on public.hr_documents;
create trigger hr_documents_touch before update on public.hr_documents
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- APPROVE LEAVE FUNCTION (server-side enforcement)
-- ===========================================================================

create or replace function public.approve_leave_request(
  req_id uuid,
  decision text,
  note text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.leave_requests;
  req public.leave_requests;
  emp_profile uuid;
  approver uuid := auth.uid();
begin
  if decision not in ('approved','rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select * into req from public.leave_requests lr where lr.id = req_id;
  if not found then
    raise exception 'leave request not found';
  end if;

  select e.profile_id into emp_profile from public.employees e where e.id = req.employee_id;
  if emp_profile = approver then
    raise exception 'you cannot approve your own leave request';
  end if;

  if not public.has_role(array['admin','hr_manager'])
     and not public.is_manager_of(emp_profile) then
    raise exception 'not authorized to approve this leave request';
  end if;

  if req.status <> 'pending' then
    raise exception 'leave request is not pending';
  end if;

  update public.leave_requests
    set status = decision,
        approver_id = approver,
        approved_at = now(),
        approver_note = note
  where id = req_id
  returning * into result;

  if decision = 'approved' then
    update public.leave_balances
      set balance = greatest(balance - req.days, 0),
          used = used + req.days
      where employee_id = req.employee_id
        and leave_type_id = req.leave_type_id
        and year = extract(year from req.start_date)::int;
  end if;

  insert into public.notifications (user_id, title, body, type, link)
  values (
    emp_profile,
    'Leave request ' || decision,
    'Your leave request from ' || req.start_date || ' to ' || req.end_date ||
      ' has been ' || decision || '.',
    case when decision = 'approved' then 'success' else 'warning' end,
    '/leave'
  );

  return result;
end;
$$;

grant execute on function public.approve_leave_request(uuid, text, text) to authenticated;
grant execute on function public.user_role() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;
grant execute on function public.managed_department() to authenticated;
grant execute on function public.is_manager_of(uuid) to authenticated;
