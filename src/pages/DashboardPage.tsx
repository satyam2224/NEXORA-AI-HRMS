import { useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  CalendarDays,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { LoadingState, ErrorState, PageHeader } from '@/components/States';
import { ROLE_LABELS, canManageEmployees, canManagePayroll } from '@/lib/rbac';
import { navigate } from '@/lib/router';

const PIE_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role || 'employee';

  const statsQ = useQuery(async () => {
    const [emp, dept, att, leave, payroll] = await Promise.all([
      supabase.from('employees').select('id, employment_status, hire_date, department_id'),
      supabase.from('analytics_department_distribution').select('department_name, employee_count'),
      supabase
        .from('attendance')
        .select('id, status, check_in')
        .gte('check_in', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from('leave_requests').select('id, status'),
      canManagePayroll(role)
        ? supabase.from('payroll_records').select('net_pay, pay_period_month, pay_period_year')
        : Promise.resolve({ data: [], error: null }),
    ]);
    return {
      data: {
        employees: emp.data || [],
        departments: dept.data || [],
        attendance: att.data || [],
        leave: leave.data || [],
        payroll: payroll.data || [],
      },
      error: null,
    };
  }, [role]);

  const growth = useMemo(() => {
    const employees = statsQ.data?.employees || [];
    const byMonth: Record<string, number> = {};
    for (const e of employees) {
      const d = new Date(e.hire_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    const sorted = Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([k, v]) => ({ month: k, hires: v }));
    let cumulative = 0;
    return sorted.map((s) => {
      cumulative += s.hires;
      return { month: s.month, total: cumulative };
    });
  }, [statsQ.data]);

  const deptData = useMemo(
    () =>
      (statsQ.data?.departments || [])
        .filter((d: any) => d.employee_count > 0)
        .map((d: any) => ({ name: d.department_name, value: d.employee_count })),
    [statsQ.data]
  );

  if (statsQ.loading) return <LoadingState message="Loading dashboard…" />;
  if (statsQ.error) return <ErrorState message={statsQ.error} onRetry={statsQ.refetch} />;

  const employees = statsQ.data?.employees || [];
  const total = employees.length;
  const active = employees.filter((e: any) => e.employment_status === 'active').length;
  const inactive = total - active;
  const attendance = statsQ.data?.attendance || [];
  const presentToday = attendance.filter(
    (a: any) => new Date(a.check_in).toDateString() === new Date().toDateString()
  ).length;
  const pendingLeave = (statsQ.data?.leave || []).filter((l: any) => l.status === 'pending').length;
  const totalPayroll = (statsQ.data?.payroll || []).reduce((s: number, p: any) => s + Number(p.net_pay), 0);

  const stats = [
    { label: 'Total Employees', value: total, icon: Users, color: 'blue', page: 'employees' },
    { label: 'Active', value: active, icon: UserCheck, color: 'emerald', page: 'employees' },
    { label: 'Inactive', value: inactive, icon: UserX, color: 'slate', page: 'employees' },
    { label: 'Present Today', value: presentToday, icon: CalendarCheck, color: 'violet', page: 'attendance' },
    { label: 'Pending Leave', value: pendingLeave, icon: CalendarDays, color: 'amber', page: 'leave' },
    ...(canManagePayroll(role)
      ? [{ label: 'Total Payroll (net)', value: `₹${totalPayroll.toLocaleString()}`, icon: Wallet, color: 'rose', page: 'payroll' }]
      : []),
  ];

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    slate: 'from-slate-500 to-slate-600 text-slate-600 bg-slate-100 dark:bg-slate-500/10',
    violet: 'from-violet-500 to-violet-600 text-violet-600 bg-violet-50 dark:bg-violet-500/10',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    rose: 'from-rose-500 to-rose-600 text-rose-600 bg-rose-50 dark:bg-rose-500/10',
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] || 'there'}`}
        subtitle={`You are signed in as ${ROLE_LABELS[role]}. Here is your workforce overview.`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          const c = colorMap[s.color];
          return (
            <button
              key={s.label}
              onClick={() => navigate(`/${s.page}`)}
              className="card group p-4 text-left transition-all hover:shadow-md"
            >
              <div className={`mb-3 inline-flex rounded-lg p-2 ${c.split(' ').slice(-2).join(' ')}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</div>
              <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                {s.label}
                <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Workforce Growth</h3>
            <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <TrendingUp className="mr-1 h-3 w-3" /> Cumulative hires
            </span>
          </div>
          {growth.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#2563eb" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No hire data yet.</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Department Distribution
          </h3>
          {deptData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {deptData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No departments yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/attendance')} className="btn-secondary justify-start">
              <CalendarCheck className="h-4 w-4" /> Check in / out
            </button>
            <button onClick={() => navigate('/leave')} className="btn-secondary justify-start">
              <CalendarDays className="h-4 w-4" /> Apply for leave
            </button>
            <button onClick={() => navigate('/ai-assistant')} className="btn-secondary justify-start">
              <Sparkles className="h-4 w-4" /> Ask AI Assistant
            </button>
            {canManageEmployees(role) && (
              <button onClick={() => navigate('/employees')} className="btn-secondary justify-start">
                <Users className="h-4 w-4" /> Manage employees
              </button>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Attendance (last 30 days)
          </h3>
          <div className="space-y-3">
            {(['present', 'late', 'half_day', 'leave'] as const).map((st) => {
              const count = attendance.filter((a: any) => a.status === st).length;
              const pct = attendance.length ? (count / attendance.length) * 100 : 0;
              const colors: Record<string, string> = {
                present: 'bg-emerald-500',
                late: 'bg-amber-500',
                half_day: 'bg-blue-500',
                leave: 'bg-violet-500',
              };
              return (
                <div key={st}>
                  <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{st.replace('_', ' ')}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full rounded-full ${colors[st]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!attendance.length && <p className="text-sm text-slate-400">No attendance records yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
