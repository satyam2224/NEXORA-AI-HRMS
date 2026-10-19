# Deployment Guide

This guide covers deploying NEXORA AI from a Bolt project.

## 1. Frontend (Bolt hosted deployment)

1. In Bolt, open the project.
2. Click **Publish** in the header.
3. Bolt builds the production frontend (`vite build`) and hosts it on a Bolt
   subdomain. You can connect a custom domain later from the project settings.
4. The deployed frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   from the Bolt environment — these are pre-populated for the provisioned
   Supabase project.

## 2. Supabase configuration

The Supabase project (database, auth, edge functions) is already provisioned and
linked. After publishing, confirm the following in the Supabase Dashboard:

### Authentication redirect URLs

Go to **Authentication → URL Configuration** and add the deployed site URL:

- **Site URL:** `https://your-bolt-subdomain.bolt.new`
- **Redirect URLs:** `https://your-bolt-subdomain.bolt.new`

This ensures password-reset links and email-confirmation links land back in the
app. Email confirmation is OFF by default; new sign-ups get a session
immediately.

### Edge Function

The `ai-hr-assistant` edge function is deployed via the Supabase MCP tool. It is
already deployed in this project. If you change its source under
`supabase/functions/ai-hr-assistant/index.ts`, redeploy with the
`deploy_edge_functions` MCP tool (it auto-detects changed functions).

### AI secrets

See [`docs/AI_SETUP.md`](./AI_SETUP.md). Set `AI_PROVIDER`, `AI_API_KEY`,
`AI_MODEL`, and optionally `AI_BASE_URL` in Supabase → Edge Functions → Secrets.

Without these, AI pages will show an honest "AI_API_KEY is not configured" error
and the rest of the app still works.

## 3. Post-deploy verification checklist

- [ ] Sign up a new account (defaults to Employee role).
- [ ] Sign out and back in.
- [ ] Create an employee record (sign up first, then edit from an admin/HR
      account).
- [ ] Check in and check out on the Attendance page.
- [ ] Apply for leave and approve it from a manager account (must be a different
      user than the applicant).
- [ ] Add a payroll record (admin/HR) and view the payslip.
- [ ] Open Analytics — charts render from real database rows.
- [ ] Open AI HR Assistant — ask a policy question. If a key is configured, you
      get a real LLM answer. If not, you see a clear error.
- [ ] On mobile width, the sidebar collapses into a slide-out drawer.
- [ ] Sign in as an Employee-role user and confirm payroll/employees pages are
      blocked (RLS + UI guard).

## 4. GitHub

Bolt can connect to your GitHub account and push the project to a public repo.
In Bolt, use the GitHub integration to create/connect the repository
`NEXORA-AI-HRMS`. Ensure `.env` is gitignored (it is) so no secrets are pushed.
