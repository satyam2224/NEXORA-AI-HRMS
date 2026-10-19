import { describe, it, expect } from 'vitest';
import { canAccess, canApproveLeave, canManagePayroll, canManageEmployees, ROLE_PAGES } from '@/lib/rbac';
import type { Role } from '@/lib/types';

describe('RBAC: role-based access control', () => {
  it('admin can access every page', () => {
    for (const page of ROLE_PAGES.admin) {
      expect(canAccess('admin', page)).toBe(true);
    }
  });

  it('employee cannot access payroll or employees', () => {
    expect(canAccess('employee', 'payroll')).toBe(false);
    expect(canAccess('employee', 'employees')).toBe(false);
    expect(canAccess('employee', 'departments')).toBe(false);
    expect(canAccess('employee', 'analytics')).toBe(false);
  });

  it('employee can access attendance, leave, ai-assistant, settings, about', () => {
    expect(canAccess('employee', 'attendance')).toBe(true);
    expect(canAccess('employee', 'leave')).toBe(true);
    expect(canAccess('employee', 'ai-assistant')).toBe(true);
    expect(canAccess('employee', 'settings')).toBe(true);
    expect(canAccess('employee', 'about')).toBe(true);
  });

  it('dept_manager can access employees but not payroll', () => {
    expect(canAccess('dept_manager', 'employees')).toBe(true);
    expect(canAccess('dept_manager', 'payroll')).toBe(false);
    expect(canAccess('dept_manager', 'departments')).toBe(false);
  });

  it('hr_manager can manage payroll and employees', () => {
    expect(canManagePayroll('hr_manager')).toBe(true);
    expect(canManageEmployees('hr_manager')).toBe(true);
  });

  it('dept_manager can approve leave but not manage payroll', () => {
    expect(canApproveLeave('dept_manager')).toBe(true);
    expect(canManagePayroll('dept_manager')).toBe(false);
  });

  it('employee cannot approve leave or manage employees', () => {
    expect(canApproveLeave('employee')).toBe(false);
    expect(canManageEmployees('employee')).toBe(false);
  });

  it('undefined role denies everything', () => {
    expect(canAccess(undefined, 'dashboard')).toBe(false);
    expect(canApproveLeave(undefined)).toBe(false);
  });

  it('every role has a page list', () => {
    const roles: Role[] = ['admin', 'hr_manager', 'dept_manager', 'employee'];
    for (const r of roles) {
      expect(ROLE_PAGES[r].length).toBeGreaterThan(0);
    }
  });
});
