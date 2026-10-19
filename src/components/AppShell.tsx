import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  CalendarDays,
  Wallet,
  BarChart3,
  Sparkles,
  FileText,
  Bell,
  Settings,
  Info,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/ThemeContext';
import { ROLE_LABELS, ROLE_BADGE_STYLES, canAccess } from '@/lib/rbac';
import { navigate } from '@/lib/router';
import type { Role } from '@/lib/types';

type NavItem = {
  page: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const ALL_NAV: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'employees', label: 'Employees', icon: Users },
  { page: 'departments', label: 'Departments', icon: Building2 },
  { page: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { page: 'leave', label: 'Leave Management', icon: CalendarDays },
  { page: 'payroll', label: 'Payroll', icon: Wallet },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'ai-assistant', label: 'AI HR Assistant', icon: Sparkles },
  { page: 'ai-jd', label: 'AI Job Description', icon: FileText },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'settings', label: 'Settings', icon: Settings },
  { page: 'about', label: 'About NEXORA AI', icon: Info },
];

export function AppShell({
  current,
  children,
  notificationCount,
}: {
  current: string;
  children: React.ReactNode;
  notificationCount: number;
}) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const role = (profile?.role as Role) || 'employee';
  const navItems = ALL_NAV.filter((n) => canAccess(role, n.page));

  const go = (page: string) => {
    navigate(`/${page}`);
    setMobileOpen(false);
  };

  const initials = (profile?.full_name || profile?.email || 'U')
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const SidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white">NEXORA AI</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400">HRMS</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.page;
          return (
            <button
              key={item.page}
              onClick={() => go(item.page)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.page === 'notifications' && notificationCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {profile?.full_name || 'User'}
            </div>
            <div className="truncate text-xs text-slate-400">{profile?.email}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{SidebarContent}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 animate-slide-in">{SidebarContent}</aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="btn-ghost rounded-lg p-1.5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => go('dashboard')}
              className="flex items-center gap-2 lg:hidden"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">NEXORA AI</span>
            </button>
            <span className="hidden text-sm font-medium capitalize text-slate-500 dark:text-slate-400 lg:block">
              {ALL_NAV.find((n) => n.page === current)?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => go('notifications')}
              className="btn-ghost relative rounded-lg p-1.5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>
            <button
              onClick={toggle}
              className="btn-ghost rounded-lg p-1.5"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg p-1 pl-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {initials}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 card p-2 animate-fade-in">
                    <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {profile?.full_name}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {profile?.email}
                      </div>
                      <span
                        className={`badge mt-2 ${ROLE_BADGE_STYLES[role]}`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        go('settings');
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </button>
                    <button
                      onClick={signOut}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Close button on mobile sidebar overlay (outside aside) */}
      {mobileOpen && (
        <button
          className="fixed right-4 top-4 z-50 rounded-lg bg-white/10 p-1.5 text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
