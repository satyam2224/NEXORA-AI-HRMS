import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { CalendarCheck, LogIn, LogOut, Clock, Calendar } from 'lucide-react';

const STATUS_LATE_THRESHOLD_MIN = 30; // 9:30 vs 9:00

export function AttendancePage() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Find this user's employee record
  const meQ = useQuery(
    () => supabase.from('employees').select('id, employee_code, department_id, profile:profiles(full_name)').eq('profile_id', profile?.id || '').maybeSingle(),
    [profile?.id]
  );

  const recordsQ = useQuery(async () => {
    const empId = (meQ.data as any)?.id;
    if (!empId) return { data: [], error: null };
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .gte('check_in', start)
      .lte('check_in', end)
      .order('check_in', { ascending: false });
    return { data, error };
  }, [meQ.data, month]);

  if (meQ.loading) return <LoadingState message="Loading your attendance…" />;
  if (meQ.error) return <ErrorState message={meQ.error} onRetry={meQ.refetch} />;

  const me = meQ.data as any;
  if (!me) {
    return (
      <div className="card">
        <EmptyState
          icon={<CalendarCheck className="h-10 w-10" />}
          title="No employee record"
          description="Your account is not linked to an employee record yet. Ask an HR manager to add you as an employee."
        />
      </div>
    );
  }

  const records = (recordsQ.data as any[]) || [];
  const today = new Date().toDateString();
  const todayRecord = records.find((r) => new Date(r.check_in).toDateString() === today);
  const checkedInToday = !!todayRecord;
  const checkedOutToday = !!todayRecord?.check_out;

  const checkIn = async () => {
    setBusy(true);
    setActionError(null);
    try {
      if (checkedInToday) { setActionError('You have already checked in today.'); return; }
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(9, 0, 0, 0);
      const lateMin = (now.getTime() - startOfDay.getTime()) / 60000;
      const status = lateMin > STATUS_LATE_THRESHOLD_MIN ? 'late' : 'present';
      const { error } = await supabase.from('attendance').insert({
        employee_id: me.id,
        check_in: now.toISOString(),
        status,
      });
      if (error) setActionError(error.message);
      else recordsQ.refetch();
    } finally { setBusy(false); }
  };

  const checkOut = async () => {
    setBusy(true);
    setActionError(null);
    try {
      if (!todayRecord) { setActionError('You have not checked in today.'); return; }
      if (checkedOutToday) { setActionError('You have already checked out today.'); return; }
      const now = new Date();
      if (new Date(now).getTime() <= new Date(todayRecord.check_in).getTime()) {
        setActionError('Check-out must be after check-in.');
        return;
      }
      const { error } = await supabase.from('attendance')
        .update({ check_out: now.toISOString() })
        .eq('id', todayRecord.id);
      if (error) setActionError(error.message);
      else recordsQ.refetch();
    } finally { setBusy(false); }
  };

  const workHours = (r: any) => {
    if (!r.check_out) return '—';
    const ms = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
    return `${(ms / 3600000).toFixed(2)}h`;
  };

  // Monthly summary
  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const totalHours = records.reduce((s, r) => {
    if (!r.check_out) return s;
    return s + (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
  }, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Attendance" subtitle="Check in, check out, and review your attendance history." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Today</h3>
          </div>
          <div className="mb-4 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>

          <div className="space-y-2">
            <button onClick={checkIn} disabled={busy || checkedInToday} className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> {checkedInToday ? 'Checked In' : 'Check In'}
            </button>
            <button onClick={checkOut} disabled={busy || !checkedInToday || checkedOutToday} className="btn-secondary w-full">
              <LogOut className="h-4 w-4" /> {checkedOutToday ? 'Checked Out' : 'Check Out'}
            </button>
          </div>

          {todayRecord && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
              <div className="flex justify-between"><span className="text-slate-500">Check in</span><span>{new Date(todayRecord.check_in).toLocaleTimeString()}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Check out</span><span>{todayRecord.check_out ? new Date(todayRecord.check_out).toLocaleTimeString() : '—'}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-500">Status</span><span className="capitalize">{todayRecord.status}</span></div>
            </div>
          )}
          {actionError && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{actionError}</div>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Summary</h3>
            <input type="month" className="input w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['present', 'late', 'half_day', 'leave'] as const).map((s) => (
              <div key={s} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-xs capitalize text-slate-500 dark:text-slate-400">{s.replace('_', ' ')}</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{summary[s] || 0}</div>
              </div>
            ))}
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total hours</div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalHours.toFixed(1)}</div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {records.length === 0 ? (
              <EmptyState icon={<Calendar className="h-8 w-8" />} title="No records this month" description="Your attendance records will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
                  <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Check In</th><th className="px-3 py-2">Check Out</th><th className="px-3 py-2">Hours</th><th className="px-3 py-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{new Date(r.check_in).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-2">{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-3 py-2">{workHours(r)}</td>
                      <td className="px-3 py-2 capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
