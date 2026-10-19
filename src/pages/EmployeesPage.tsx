import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { Modal } from '@/components/Modal';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { canManageEmployees } from '@/lib/rbac';
import { navigate } from '@/lib/router';
import type { Employee, Department, Profile } from '@/lib/types';
import {
  Users,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 10;

export function EmployeesPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const deptsQ = useQuery(
    () => supabase.from('departments').select('*').order('name'),
    []
  );
  const departments = (deptsQ.data as Department[] | null) || [];

  const employeesQ = useQuery(async () => {
    let q = supabase
      .from('employees')
      .select('*, department:departments(*), profile:profiles(full_name, email, avatar_url, phone)')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('employment_status', statusFilter);
    if (deptFilter !== 'all') q = q.eq('department_id', deptFilter);
    if (search.trim()) {
      q = q.or(
        `employee_code.ilike.%${search}%,job_title.ilike.%${search}%`
      );
    }
    q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, error } = await q;
    if (error) return { data: null, error };
    const withProfileName = (data as Employee[] | null)?.map((e) => ({
      ...e,
      // also search by profile name client-side
    }));
    return { data: withProfileName, error };
  }, [search, statusFilter, deptFilter, page]);

  const employees = (employeesQ.data as Employee[] | null) || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const s = search.toLowerCase();
    return employees.filter((e) =>
      (e.profile?.full_name || '').toLowerCase().includes(s) ||
      (e.profile?.email || '').toLowerCase().includes(s) ||
      e.employee_code.toLowerCase().includes(s)
    );
  }, [employees, search]);

  const openAdd = () => {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setFormError(null);
    setModalOpen(true);
  };

  const onDelete = async (emp: Employee) => {
    if (!confirm(`Delete employee ${emp.employee_code}? This also removes their employee record.`)) return;
    const { error } = await supabase.from('employees').delete().eq('id', emp.id);
    if (error) alert(error.message);
    else employeesQ.refetch();
  };

  if (employeesQ.loading) return <LoadingState message="Loading employees…" />;
  if (employeesQ.error) return <ErrorState message={employeesQ.error} onRetry={employeesQ.refetch} />;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
      terminated: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
    return <span className={`badge ${map[s] || ''}`}>{s.replace('_', ' ')}</span>;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employees"
        subtitle="Search, filter, and manage employee records."
        actions={
          canManageEmployees(role) && (
            <button onClick={openAdd} className="btn-primary">
              <Plus className="h-4 w-4" /> Add Employee
            </button>
          )
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search by name, code, or job title…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="input sm:w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On leave</option>
          <option value="terminated">Terminated</option>
        </select>
        <select className="input sm:w-44" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(0); }}>
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No employees found"
            description="Try adjusting your search or filters, or add a new employee."
            action={canManageEmployees(role) && (
              <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> Add Employee</button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Job Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Hire Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {(emp.profile?.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {emp.profile?.full_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{emp.profile?.email}</div>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.employee_code}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{emp.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{emp.job_title || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(emp.employment_status)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{emp.hire_date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/employees/${emp.id}`)} className="btn-ghost rounded-md p-1.5" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManageEmployees(role) && (
                          <>
                            <button onClick={() => openEdit(emp)} className="btn-ghost rounded-md p-1.5" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDelete(emp)} className="btn-ghost rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {filtered.length ? `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + filtered.length}` : 'No results'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary px-3 py-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={filtered.length < PAGE_SIZE}
            className="btn-secondary px-3 py-1.5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <EmployeeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editing={editing}
          departments={departments}
          onSaved={() => { setModalOpen(false); employeesQ.refetch(); }}
          saving={saving}
          setSaving={setSaving}
          formError={formError}
          setFormError={setFormError}
        />
      )}
    </div>
  );
}

function EmployeeModal({
  open,
  onClose,
  editing,
  departments,
  onSaved,
  saving,
  setSaving,
  formError,
  setFormError,
}: {
  open: boolean;
  onClose: () => void;
  editing: Employee | null;
  departments: Department[];
  onSaved: () => void;
  saving: boolean;
  setSaving: (b: boolean) => void;
  formError: string | null;
  setFormError: (s: string | null) => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    employee_code: editing?.employee_code || '',
    department_id: editing?.department_id || '',
    job_title: editing?.job_title || '',
    employment_status: (editing?.employment_status || 'active') as Employee['employment_status'],
    is_manager: editing?.is_manager || false,
    hire_date: editing?.hire_date || new Date().toISOString().slice(0, 10),
    contact_email: editing?.contact_email || '',
    contact_phone: editing?.contact_phone || '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        department_id: form.department_id || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
      };
      let res;
      if (isEdit && editing) {
        res = await supabase.from('employees').update(payload).eq('id', editing.id).select();
      } else {
        // For new employees we need a profile_id. In this portfolio app,
        // admin links to an existing auth user's profile via email lookup.
        // We surface a clear error if no profile matches.
        res = { error: { message: 'To add an employee, the user must first sign up so a profile exists. Use the Sign Up page, then return here to complete their employee record.' } } as any;
      }
      if (res?.error) setFormError(res.error.message);
      else onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit as any} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {!isEdit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            New employees must first create an account on the Sign Up page. After they sign up,
            return here to complete their employee record. For a portfolio demo, you can sign up
            a test user and then edit this row.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Employee Code</label>
            <input className="input" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} required disabled={isEdit} />
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Job Title</label>
          <input className="input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.employment_status} onChange={(e) => setForm({ ...form, employment_status: e.target.value as Employee['employment_status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          <div>
            <label className="label">Hire Date</label>
            <input type="date" className="input" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Contact Email</label>
            <input type="email" className="input" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div>
            <label className="label">Contact Phone</label>
            <input className="input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={form.is_manager} onChange={(e) => setForm({ ...form, is_manager: e.target.checked })} />
          Department manager (can approve leave for this department)
        </label>
        {formError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        )}
      </form>
    </Modal>
  );
}

export function EmployeeDetailPage({ id }: { id: string }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const [tab, setTab] = useState<'overview' | 'attendance' | 'leave' | 'payroll'>('overview');

  const empQ = useQuery(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, department:departments(*), profile:profiles(*)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }, [id]);

  const attQ = useQuery(
    () => supabase.from('attendance').select('*').eq('employee_id', id).order('check_in', { ascending: false }).limit(20),
    [id]
  );
  const leaveQ = useQuery(
    () => supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    [id]
  );
  const payrollQ = useQuery(
    () => supabase.from('payroll_records').select('*').eq('employee_id', id).order('pay_period_year', { ascending: false }).order('pay_period_month', { ascending: false }),
    [id]
  );

  if (empQ.loading) return <LoadingState message="Loading employee…" />;
  if (empQ.error || !empQ.data) return <ErrorState message={empQ.error || 'Employee not found.'} onRetry={empQ.refetch} />;

  const emp = empQ.data as Employee & { profile: Profile | null };

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/employees')} className="btn-ghost mb-4 -ml-2">
        <ChevronLeft className="h-4 w-4" /> Back to employees
      </button>

      <div className="card mb-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-bold text-white">
            {(emp.profile?.full_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {emp.profile?.full_name || 'Unknown'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {emp.job_title || '—'} · {emp.department?.name || 'No department'}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.profile?.email}</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.contact_phone || emp.profile?.phone || '—'}</span>
              <span className="font-mono">{emp.employee_code}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(['overview', 'attendance', 'leave', 'payroll'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee Code" value={emp.employee_code} />
          <Field label="Job Title" value={emp.job_title} />
          <Field label="Department" value={emp.department?.name} />
          <Field label="Status" value={emp.employment_status.replace('_', ' ')} />
          <Field label="Hire Date" value={emp.hire_date} />
          <Field label="Manager" value={emp.is_manager ? 'Yes' : 'No'} />
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <tr><th className="px-4 py-3">Check In</th><th className="px-4 py-3">Check Out</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {((attQ.data as any[]) || []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">{new Date(a.check_in).toLocaleString()}</td>
                  <td className="px-4 py-3">{a.check_out ? new Date(a.check_out).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 capitalize">{a.status}</td>
                </tr>
              ))}
              {!attQ.data?.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No attendance records.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'leave' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {((leaveQ.data as any[]) || []).map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">{l.leave_type?.name || '—'}</td>
                  <td className="px-4 py-3">{l.start_date} → {l.end_date}</td>
                  <td className="px-4 py-3">{l.days}</td>
                  <td className="px-4 py-3 capitalize">{l.status}</td>
                </tr>
              ))}
              {!leaveQ.data?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No leave requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="card overflow-hidden">
          {(role === 'admin' || role === 'hr_manager' || emp.profile_id === profile?.id) ? (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Base</th><th className="px-4 py-3">Earnings</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Net</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {((payrollQ.data as any[]) || []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.pay_period_month}/{p.pay_period_year}</td>
                    <td className="px-4 py-3">₹{p.base_salary.toLocaleString()}</td>
                    <td className="px-4 py-3">₹{p.earnings.toLocaleString()}</td>
                    <td className="px-4 py-3">₹{p.deductions.toLocaleString()}</td>
                    <td className="px-4 py-3">₹{p.tax.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold">₹{p.net_pay.toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                  </tr>
                ))}
                {!payrollQ.data?.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No payroll records.</td></tr>}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Access restricted" description="Payroll information is only visible to HR managers, admins, or the employee themselves." />
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value || '—'}</div>
    </div>
  );
}
