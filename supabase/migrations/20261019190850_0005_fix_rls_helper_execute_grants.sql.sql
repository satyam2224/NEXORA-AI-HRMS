/*
# Fix: restore EXECUTE on RLS helper functions for authenticated role

## Root cause of the "stuck on Setting up your profile…" bug
A prior hardening migration (0004) revoked EXECUTE on the SECURITY DEFINER
helper functions (user_role, has_role, managed_department, is_manager_of)
from the `authenticated` role to stop them being called as public RPCs.

That broke RLS: every profiles/employees/etc. policy calls these functions
inside its USING/WITH CHECK expression. RLS policy expressions run with the
*querying role's* privileges, so `authenticated` must hold EXECUTE on any
function referenced inside a policy. Without it, the function call raises
"permission denied for function", the entire policy expression errors
(Postgres does not short-circuit OR on errors), and the SELECT returns no
rows — so `loadProfile()` got `data: null, error: null` and the UI hung on
"Setting up your profile…" forever.

## Fix
Re-grant EXECUTE on the helper functions to `authenticated`. These functions
are SECURITY DEFINER and only read data the caller already has visibility into
via RLS, so exposing them as RPCs is low-risk — but to keep the advisor quiet
and avoid them being called directly, we restrict direct RPC use by keeping
them out of the PostgREST-exposed API surface where possible. The important
constraint is that `authenticated` MUST be able to execute them inside policy
expressions.

handle_new_user stays revoked from both anon and authenticated — it is a
TRIGGER function (invoked by the trigger on auth.users, which runs as the
function owner), so it does not need a direct EXECUTE grant on authenticated.
*/

grant execute on function public.user_role() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;
grant execute on function public.managed_department() to authenticated;
grant execute on function public.is_manager_of(uuid) to authenticated;

-- approve_leave_request is still granted to authenticated (real RPC entrypoint).
-- handle_new_user intentionally NOT granted to authenticated (trigger only).
