import { useAuth } from '@/auth/AuthContext';
import { useHashRoute, parseRoute, navigate } from '@/lib/router';
import { canAccess } from '@/lib/rbac';
import { AppShell } from '@/components/AppShell';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage, EmployeeDetailPage } from '@/pages/EmployeesPage';
import { DepartmentsPage } from '@/pages/DepartmentsPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { LeavePage } from '@/pages/LeavePage';
import { PayrollPage } from '@/pages/PayrollPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AIAssistantPage } from '@/pages/AIAssistantPage';
import { AIJDPage } from '@/pages/AIJDPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AboutPage } from '@/pages/AboutPage';
import { ErrorState, LoadingState } from '@/components/States';
import { useQuery } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

function App() {
  const { session, profile, loading, profileError, retryProfile } = useAuth();
  const hash = useHashRoute();
  const { page, params } = parseRoute(hash);

  // Notification count for the sidebar badge
  const notifQ = useQuery(
    () => supabase.from('notifications').select('id').eq('user_id', profile?.id || '').eq('read', false),
    [profile?.id]
  );
  const notifCount = (notifQ.data as any[] | null)?.length || 0;

  // Redirect to dashboard on login
  useEffect(() => {
    if (session && (page === 'login' || page === 'signup')) navigate('/dashboard');
  }, [session, page]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState message="Loading NEXORA AI…" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (!profile) {
    // A profile error (RLS denial, network/timeout, or missing row that could
    // not be self-healed) must never leave the user stuck on a spinner.
    if (profileError) {
      const friendly =
        profileError.code === 'rls'
          ? 'Your profile could not be loaded because of a database permission rule. Please sign out and try again, or contact an administrator.'
          : profileError.code === 'network'
          ? 'We could not reach the database to load your profile. Check your connection and try again.'
          : profileError.code === 'not_found'
          ? 'Your profile is missing and could not be created automatically. Please contact an administrator.'
          : 'Something went wrong while loading your profile.';
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-md px-6">
            <ErrorState message={friendly} onRetry={() => retryProfile()} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState message="Setting up your profile…" />
      </div>
    );
  }

  // Access guard
  if (!canAccess(profile.role, page) && page !== 'employees') {
    return (
      <AppShell current="dashboard" notificationCount={notifCount}>
        <div className="card p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Access restricted</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your role does not have access to this page.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">Go to Dashboard</button>
        </div>
      </AppShell>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'employees': return params[0] ? <EmployeeDetailPage id={params[0]} /> : <EmployeesPage />;
      case 'departments': return <DepartmentsPage />;
      case 'attendance': return <AttendancePage />;
      case 'leave': return <LeavePage />;
      case 'payroll': return <PayrollPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'ai-assistant': return <AIAssistantPage />;
      case 'ai-jd': return <AIJDPage />;
      case 'notifications': return <NotificationsPage />;
      case 'settings': return <SettingsPage />;
      case 'about': return <AboutPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <AppShell current={page} notificationCount={notifCount}>
      {renderPage()}
    </AppShell>
  );
}

export default App;
