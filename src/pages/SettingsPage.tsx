import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/States';
import { ROLE_LABELS, ROLE_BADGE_STYLES } from '@/lib/rbac';
import { Sun, Moon, User, Mail, Phone, Save, Check } from 'lucide-react';

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [full_name, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    const { error } = await supabase.from('profiles').update({ full_name, phone }).eq('id', profile?.id || '');
    if (error) setError(error.message);
    else { setSaved(true); refreshProfile(); }
    setSaving(false);
  };

  if (!profile) return null;
  const role = profile.role;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your profile and preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><User className="h-4 w-4" /> Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-10" value={profile.email} disabled /></div>
            </div>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={full_name} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Role</label>
              <span className={`badge ${ROLE_BADGE_STYLES[role]}`}>{ROLE_LABELS[role]}</span>
              <p className="mt-1 text-xs text-slate-400">Roles are assigned by an administrator.</p>
            </div>
            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : <><Save className="h-4 w-4" /> Save changes</>}
            </button>
            {saved && <span className="ml-2 inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Saved</span>}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTheme('light')} className={`rounded-lg border p-4 text-left transition-all ${theme === 'light' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <Sun className="mb-2 h-5 w-5 text-amber-500" />
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Light</div>
            </button>
            <button onClick={() => setTheme('dark')} className={`rounded-lg border p-4 text-left transition-all ${theme === 'dark' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <Moon className="mb-2 h-5 w-5 text-violet-500" />
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Dark</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
