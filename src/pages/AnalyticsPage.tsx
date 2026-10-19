import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { canManagePayroll } from '@/lib/rbac';
import { LoadingState, ErrorState, PageHeader } from '@/components/States';
import { AI_ACTIONS } from '@/lib/ai';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const PIE_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AnalyticsPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const q = useQuery(async () => {
    const [emp, dept, att, leave, payroll] = await Promise.all([
      supabase.from('employees').select('employment_status, hire_date, department_id'),
      supabase.from('analytics_department_distribution').select('department_name, employee_count'),
      supabase.from('attendance').select('status, check_in').gte('check_in', new Date(Date.now() - 90 * 86400000).toISOString()),
      supabase.from('leave_requests').select('status, leave_type_id, created_at'),
      canManagePayroll(role) ? supabase.from('payroll_records').select('net_pay, pay_period_month, pay_period_year') : Promise.resolve({ data: [], error: null }),
    ]);
    return {
      data: {
        employees: emp.data || [], departments: dept.data || [],
        attendance: att.data || [], leave: leave.data || [],
        payroll: payroll.data || [],
      },
      error: null,
    };
  }, [role]);

  const attTrend = useMemo(() => {
    const att = (q.data?.attendance || []) as any[];
    const byDay: Record<string, { date: string; present: number; late: number }> = {};
    for (const a of att) {
      const d = new Date(a.check_in).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { date: d, present: 0, late: 0 };
      if (a.status === 'present') byDay[d].present++;
      else if (a.status === 'late') byDay[d].late++;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [q.data]);

  const leaveStats = useMemo(() => {
    const leave = (q.data?.leave || []) as any[];
    const byStatus: Record<string, number> = {};
    for (const l of leave) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    return Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  }, [q.data]);

  const deptData = useMemo(
    () => (q.data?.departments || []).filter((d: any) => d.employee_count > 0).map((d: any) => ({ name: d.department_name, value: d.employee_count })),
    [q.data]
  );

  const payrollByMonth = useMemo(() => {
    const p = (q.data?.payroll || []) as any[];
    const byMonth: Record<string, number> = {};
    for (const r of p) {
      const k = `${r.pay_period_year}-${String(r.pay_period_month).padStart(2, '0')}`;
      byMonth[k] = (byMonth[k] || 0) + Number(r.net_pay);
    }
    return Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));
  }, [q.data]);

  if (q.loading) return <LoadingState message="Loading analytics…" />;
  if (q.error) return <ErrorState message={q.error} onRetry={q.refetch} />;

  const employees = (q.data?.employees || []) as any[];
  const total = employees.length;
  const active = employees.filter((e) => e.employment_status === 'active').length;

  const runInsights = async () => {
    setInsightLoading(true); setInsightError(null); setInsight(null);
    const res = await AI_ACTIONS.insights();
    if (res.ok) setInsight(res.insights);
    else setInsightError(res.error);
    setInsightLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Analytics" subtitle="Workforce trends, attendance, leave, and payroll summaries." />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Employees" value={total} />
        <Stat label="Active" value={active} />
        <Stat label="Inactive" value={total - active} />
        <Stat label="Leave Requests" value={(q.data?.leave || []).length} />
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Workforce Insights</h3>
          <button onClick={runInsights} disabled={insightLoading} className="btn-secondary">
            {insightLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {insight ? 'Regenerate' : 'Generate Insights'}
          </button>
        </div>
        {insightError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{insightError}</div>}
        {insight && <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">{insight}</div>}
        {!insight && !insightError && !insightLoading && (
          <p className="text-sm text-slate-400">Click "Generate Insights" to ask the AI to identify trends in your workforce, attendance, and leave data. The AI uses only authorized aggregate data and labels interpretations clearly.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Attendance Trend (90 days)">
          {attTrend.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={attTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Department Distribution">
          {deptData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {deptData.map((_d: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Leave Status Breakdown">
          {leaveStats.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leaveStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        {canManagePayroll(role) && (
          <ChartCard title="Payroll by Month">
            {payrollByMonth.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={payrollByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="py-16 text-center text-sm text-slate-400">No data yet.</p>;
}
