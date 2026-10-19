import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { Modal } from '@/components/Modal';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { canApproveLeave } from '@/lib/rbac';
import { CalendarDays, Plus, Check, X, Clock } from 'lucide-react';
import type { LeaveType, LeaveRequest } from '@/lib/types';

export function LeavePage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [tab, setTab] = useState<'mine' | 'pending' | 'all'>('mine');
  const [modalOpen, setModalOpen] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const typesQ = useQuery(() => supabase.from('leave_types').select('*').order('name'), []);
  const leaveTypes = (typesQ.data as LeaveType[]) || [];

  const meQ = useQuery(
    () => supabase.from('employees').select('id').eq('profile_id', profile?.id || '').maybeSingle(),
    [profile?.id]
  );
  const myEmpId = (meQ.data as any)?.id;

  const leaveQ = useQuery(async () => {
    let q = supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(*), employee:employees(employee_code, profile:profiles(full_name))')
      .order('created_at', { ascending: false });
    if (tab === 'mine' && myEmpId) q = q.eq('employee_id', myEmpId);
    else if (tab === 'pending') q = q.eq('status', 'pending');
    const { data, error } = await q;
    return { data, error };
  }, [tab, myEmpId]);

  const balancesQ = useQuery(async () => {
    if (!myEmpId) return { data: [], error: null };
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', myEmpId)
      .eq('year', new Date().getFullYear());
    return { data, error };
  }, [myEmpId]);

  if (leaveQ.loading && !leaveQ.data) return <LoadingState message="Loading leave…" />;
  if (leaveQ.error) return <ErrorState message={leaveQ.error} onRetry={leaveQ.refetch} />;

  const requests = (leaveQ.data as LeaveRequest[]) || [];

  const decide = async (req: LeaveRequest, decision: 'approved' | 'rejected') => {
    setApproving(req.id);
    try {
      const { data, error } = await supabase.rpc('approve_leave_request', {
        req_id: req.id,
        decision,
        note: null,
      });
      if (error) alert(error.message);
      else leaveQ.refetch();
    } finally {
      setApproving(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    };
    return <span className={`badge ${map[s]}`}>{s}</span>;
  };

  const balances = (balancesQ.data as any[]) || [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave, track balances, and approve requests."
        actions={myEmpId && (
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        )}
      />

      {myEmpId && balances.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {balances.map((b) => (
            <div key={b.id} className="card p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">{b.leave_type?.name}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{b.balance}</div>
              <div className="text-[10px] text-slate-400">used {b.used}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>My Leave</TabBtn>
        {canApproveLeave(role) && <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>Pending Approval</TabBtn>}
        {canApproveLeave(role) && <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>All Requests</TabBtn>}
      </div>

      <div className="card overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="No leave requests" description="Apply for leave to see it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <tr>
                  {tab !== 'mine' && <th className="px-4 py-3">Employee</th>}
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  {canApproveLeave(role) && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    {tab !== 'mine' && <td className="px-4 py-3">{r.employee?.profile?.full_name || '—'}</td>}
                    <td className="px-4 py-3">{r.leave_type?.name}</td>
                    <td className="px-4 py-3">{r.start_date} → {r.end_date}</td>
                    <td className="px-4 py-3">{r.days}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-500">{r.reason || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    {canApproveLeave(role) && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {r.status === 'pending' ? (
                            <>
                              <button onClick={() => decide(r, 'approved')} disabled={approving === r.id} className="btn-ghost rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Approve">
                                {approving === r.id ? <Clock className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button onClick={() => decide(r, 'rejected')} disabled={approving === r.id} className="btn-ghost rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Reject">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : <span className="text-xs text-slate-400">{r.approver_note || '—'}</span>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && myEmpId && (
        <LeaveModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          employeeId={myEmpId}
          leaveTypes={leaveTypes}
          onSaved={() => { setModalOpen(false); leaveQ.refetch(); balancesQ.refetch(); }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

function LeaveModal({
  open, onClose, employeeId, leaveTypes, onSaved,
}: { open: boolean; onClose: () => void; employeeId: string; leaveTypes: LeaveType[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    leave_type_id: leaveTypes[0]?.id || '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = (() => {
    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: employeeId,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      reason: form.reason || null,
    });
    if (error) setError(error.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Apply for Leave"
      footer={<><button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit as any} disabled={saving} className="btn-primary">{saving ? 'Submitting…' : 'Submit'}</button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Leave Type</label>
          <select className="input" value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })} required>
            {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Start Date</label>
            <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
          </div>
          <div><label className="label">End Date</label>
            <input type="date" className="input" value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Duration: <span className="font-semibold">{days} day{days !== 1 ? 's' : ''}</span>
        </div>
        <div><label className="label">Reason</label>
          <textarea className="input min-h-20" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      </form>
    </Modal>
  );
}
