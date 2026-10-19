import type { Role } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  hr_manager: 'HR Manager',
  dept_manager: 'Department Manager',
  employee: 'Employee',
};

export const ROLE_BADGE_STYLES: Record<Role, string> = {
  admin: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  hr_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  dept_manager:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  employee:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

// Pages a role can access. Used by the sidebar and route guards.
export const ROLE_PAGES: Record<Role, string[]> = {
  admin: [
    'dashboard',
    'employees',
    'departments',
    'attendance',
    'leave',
    'payroll',
    'analytics',
    'ai-assistant',
    'ai-jd',
    'notifications',
    'settings',
    'about',
  ],
  hr_manager: [
    'dashboard',
    'employees',
    'departments',
    'attendance',
    'leave',
    'payroll',
    'analytics',
    'ai-assistant',
    'ai-jd',
    'notifications',
    'settings',
    'about',
  ],
  dept_manager: [
    'dashboard',
    'employees',
    'attendance',
    'leave',
    'analytics',
    'ai-assistant',
    'ai-jd',
    'notifications',
    'settings',
    'about',
  ],
  employee: [
    'dashboard',
    'attendance',
    'leave',
    'ai-assistant',
    'notifications',
    'settings',
    'about',
  ],
};

export function canAccess(role: Role | undefined, page: string): boolean {
  if (!role) return false;
  return ROLE_PAGES[role].includes(page);
}

// Whether a role can approve leave requests.
export function canApproveLeave(role: Role | undefined): boolean {
  return role === 'admin' || role === 'hr_manager' || role === 'dept_manager';
}

// Whether a role can manage payroll.
export function canManagePayroll(role: Role | undefined): boolean {
  return role === 'admin' || role === 'hr_manager';
}

// Whether a role can manage employees (CRUD).
export function canManageEmployees(role: Role | undefined): boolean {
  return role === 'admin' || role === 'hr_manager';
}

// Whether a role can manage departments.
export function canManageDepartments(role: Role | undefined): boolean {
  return role === 'admin' || role === 'hr_manager';
}
