import { useState } from 'react';
import { Sparkles, Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { ROLE_LABELS } from '@/lib/rbac';
import type { Role } from '@/lib/types';

type Mode = 'signin' | 'signup' | 'reset';

export function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else if (mode === 'signup') {
        const { error, needsConfirmation } = await signUp(email, password, fullName, role);
        if (error) setError(error);
        else if (needsConfirmation) {
          setInfo('Check your email for a confirmation link before signing in.');
          setMode('signin');
        }
      } else {
        const { error } = await resetPassword(email);
        if (error) setError(error);
        else setInfo('Password reset link sent. Check your email.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
      {/* Left brand panel */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white lg:p-14">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-violet-600/20 to-transparent" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(59,130,246,0.3) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.25) 0, transparent 40%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">NEXORA AI</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Intelligent HRMS
            </div>
          </div>
        </div>

        <div className="relative z-10 my-12 max-w-md">
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
            The intelligent way to manage your workforce.
          </h1>
          <p className="mt-4 text-slate-300">
            Employees, attendance, leave, payroll, and AI-powered HR insights — all in one
            secure, role-aware platform.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Role-based access control enforced in the database',
              'AI HR assistant with retrieval-augmented policy answers',
              'Real-time analytics on attendance, leave, and payroll',
            ].map((f) => (
              <li key={f} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                  <ArrowRight className="h-3 w-3" />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          Portfolio project · Supabase · React · TypeScript
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'reset' && 'Reset your password'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {mode === 'signin' && 'Sign in to your NEXORA AI workspace.'}
              {mode === 'signup' && 'New accounts are created with the Employee role by default.'}
              {mode === 'reset' && 'Enter your email and we will send you a reset link.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="name"
                    className="input pl-10"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  className="input pl-10"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="role">Role</label>
                <select
                  id="role"
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {(['employee', 'dept_manager', 'hr_manager', 'admin'] as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  For demo purposes you can pick a role. In production, roles are assigned by an admin.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                {info}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Please wait…' : (
                mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signin' && (
              <>
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  Don't have an account? Sign up
                </button>
                <br />
                <button onClick={() => { setMode('reset'); setError(null); setInfo(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  Forgot your password?
                </button>
              </>
            )}
            {mode !== 'signin' && (
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
