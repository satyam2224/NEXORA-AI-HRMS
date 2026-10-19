/*
# Security hardening part 2 — remove default PUBLIC execute on SECURITY DEFINER
# functions so unauthenticated users cannot call them via /rest/v1/rpc/.
*/

-- Drop the default PUBLIC grant (covers anon implicitly) on all SECURITY
-- DEFINER functions, then re-grant only where a signed-in user genuinely
-- needs to call the function via RPC.
revoke execute on function public.approve_leave_request(uuid, text, text) from public;
revoke execute on function public.user_role() from public;
revoke execute on function public.has_role(text[]) from public;
revoke execute on function public.managed_department() from public;
revoke execute on function public.is_manager_of(uuid) from public;
revoke execute on function public.handle_new_user() from public;

-- approve_leave_request is the only one meant to be called directly by
-- authenticated users via RPC.
grant execute on function public.approve_leave_request(uuid, text, text) to authenticated;

-- handle_new_user runs as a trigger on auth.users (trigger invocation does not
-- require EXECUTE grant), so no grant is needed for authenticated either.
