import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { Modal } from '@/components/Modal';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '@/components/States';
import { canManagePayroll } from '@/lib/rbac';
import { Wallet, Plus, FileText, Download } from 'lucide-react';
import type { Employee, PayrollRecord } from '@/lib/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function PayrollPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [modalOpen, setModalOpen] = useState(false);
  const [slip, setSlip] = useState<PayrollRecord | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const payrollQ = useQuery(async () => {
    if (canManagePayroll(role)) {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*, employee:employees(employee_code, job_title, profile:profiles(full_name, email))')
        .eq('pay_period_year', filterYear)
        .order('pay_period_month', { ascending: false });
      return { data, error };
    }
    // Employee sees only own
    const { data: emp } = await supabase.from('employees').select('id').eq('profile_id', profile?.id || '').maybeSingle();
    if (!emp) return { data: [], error: null };
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*, employee:employees(employee_code, job_title, profile:profiles(full_name, email))')
      .eq('employee_id', (emp as any).id)
      .order('pay_period_year', { ascending: false })
      .order('pay_period_month', { ascending: false });
    return { data, error };
  }, [role, filterYear]);

  if (payrollQ.loading) return <LoadingState message="Loading payroll…" />;
  if (payrollQ.error) return <ErrorState message={payrollQ.error} onRetry={payrollQ.refetch} />;

  const records = (payrollQ.data as (PayrollRecord & { employee?: any })[]) || [];
  const totalNet = records.reduce((s, r) => s + Number(r.net_pay), 0);
  const totalTax = records.reduce((s, r) => s + Number(r.tax), 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Payroll"
        subtitle="Salary records, monthly payroll, and payslip generation."
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-28" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
              {[filterYear, filterYear - 1, filterYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {canManagePayroll(role) && (
              <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add Record</button>
            )}
          </div>
        }
      />

      {canManagePayroll(role) && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Net Payroll" value={`₹${totalNet.toLocaleString()}`} />
          <StatCard label="Total Tax Withheld" value={`₹${totalTax.toLocaleString()}`} />
          <StatCard label="Records" value={String(records.length)} />
        </div>
      )}

      <div className="card overflow-hidden">
        {records.length === 0 ? (
          <EmptyState icon={<Wallet className="h-10 w-10" />} title="No payroll records" description={canManagePayroll(role) ? "Add a payroll record for an employee." : "Your payroll records will appear here."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <tr>
                  {canManagePayroll(role) && <th className="px-4 py-3">Employee</th>}
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Earnings</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Tax</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    {canManagePayroll(role) && <td className="px-4 py-3">{r.employee?.profile?.full_name || '—'}</td>}
                    <td className="px-4 py-3">{MONTHS[r.pay_period_month - 1]} {r.pay_period_year}</td>
                    <td className="px-4 py-3">₹{r.base_salary.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-600">₹{r.earnings.toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-600">₹{r.deductions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-600">₹{r.tax.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold">₹{r.net_pay.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : r.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSlip(r)} className="btn-ghost rounded-md p-1.5" title="View payslip">
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Portfolio implementation. Payroll figures are illustrative and not verified for tax or legal compliance.
      </p>

      {modalOpen && canManagePayroll(role) && (
        <PayrollModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); payrollQ.refetch(); }} />
      )}

      {slip && <PayslipModal record={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function PayslipModal({ record, onClose }: { record: PayrollRecord & { employee?: any }; onClose: () => void }) {
  const emp = record.employee;
  const print = () => window.print();
  return (
    <Modal open onClose={onClose} title={`Payslip — ${MONTHS[record.pay_period_month - 1]} ${record.pay_period_year}`}
      footer={<><button onClick={onClose} className="btn-secondary">Close</button>
        <button onClick={print} className="btn-primary"><Download className="h-4 w-4" /> Print</button></>}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">NEXORA AI</div>
            <div className="text-xs text-slate-500">Payslip</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-500">Period</div>
            <div className="font-medium">{MONTHS[record.pay_period_month - 1]} {record.pay_period_year}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs text-slate-400">Employee</div><div className="font-medium">{emp?.profile?.full_name || '—'}</div></div>
          <div><div className="text-xs text-slate-400">Code</div><div className="font-medium">{emp?.employee_code || '—'}</div></div>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <Row label="Base Salary" value={`₹${record.base_salary.toLocaleString()}`} />
            <Row label="Earnings / Bonus" value={`+ ₹${record.earnings.toLocaleString()}`} positive />
            <Row label="Deductions" value={`- ₹${record.deductions.toLocaleString()}`} negative />
            <Row label="Tax" value={`- ₹${record.tax.toLocaleString()}`} negative />
            <tr><td className="px-0 py-3 font-bold">Net Pay</td><td className="px-0 py-3 text-right text-lg font-bold text-blue-600">₹{record.net_pay.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <div className="text-xs text-slate-400">Status: <span className="capitalize">{record.status}</span>{record.payment_date ? ` · Paid on ${record.payment_date}` : ''}</div>
      </div>
    </Modal>
  );
}

function Row({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <tr>
      <td className="px-0 py-2 text-slate-600 dark:text-slate-400">{label}</td>
      <td className={`px-0 py-2 text-right font-medium ${positive ? 'text-emerald-600' : negative ? 'text-rose-600' : ''}`}>{value}</td>
    </tr>
  );
}

function PayrollModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({
    employee_id: '', pay_period_month: new Date().getMonth() + 1, pay_period_year: new Date().getFullYear(),
    base_salary: 0, earnings: 0, deductions: 0, tax: 0, status: 'draft', notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('employees').select('*, profile:profiles(full_name)').then(({ data }) => setEmployees((data as Employee[]) || []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('payroll_records').insert({
      ...form,
      pay_period_month: Number(form.pay_period_month),
      pay_period_year: Number(form.pay_period_year),
      base_salary: Number(form.base_salary),
      earnings: Number(form.earnings),
      deductions: Number(form.deductions),
      tax: Number(form.tax),
      notes: form.notes || null,
    });
    if (error) setError(error.message);
    else onSaved();
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Payroll Record"
      footer={<><button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit as any} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Employee</label>
          <select className="input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{(e as any).profile?.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Month</label>
            <select className="input" value={form.pay_period_month} onChange={(e) => setForm({ ...form, pay_period_month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Year</label>
            <input type="number" className="input" value={form.pay_period_year} onChange={(e) => setForm({ ...form, pay_period_year: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Base Salary (₹)</label><input type="number" className="input" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
          <div><label className="label">Earnings (₹)</label><input type="number" className="input" value={form.earnings} onChange={(e) => setForm({ ...form, earnings: Number(e.target.value) })} /></div>
          <div><label className="label">Deductions (₹)</label><input type="number" className="input" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: Number(e.target.value) })} /></div>
          <div><label className="label">Tax (₹)</label><input type="number" className="input" value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} /></div>
        </div>
        <div><label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option><option value="approved">Approved</option><option value="paid">Paid</option>
          </select>
        </div>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      </form>
    </Modal>
  );
}
