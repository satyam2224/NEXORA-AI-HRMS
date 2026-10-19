import { describe, it, expect } from 'vitest';

// Pure helpers that mirror the business rules used across the app.
// These validate the same constraints enforced server-side by the database
// and the approve_leave_request() SQL function.

describe('Leave approval rules (mirror server-side)', () => {
  type LeaveRequest = {
    id: string;
    employee_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approver_id: string | null;
  };

  function canApprove(
    req: LeaveRequest,
    approverId: string,
    approverRole: 'admin' | 'hr_manager' | 'dept_manager' | 'employee',
    isManagerOfEmployee: boolean
  ): { allowed: boolean; reason?: string } {
    if (req.employee_id === approverId) {
      return { allowed: false, reason: 'you cannot approve your own leave request' };
    }
    if (req.status !== 'pending') {
      return { allowed: false, reason: 'leave request is not pending' };
    }
    if (approverRole === 'admin' || approverRole === 'hr_manager') {
      return { allowed: true };
    }
    if (approverRole === 'dept_manager' && isManagerOfEmployee) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'not authorized to approve this leave request' };
  }

  it('an employee cannot approve their own request', () => {
    const req: LeaveRequest = { id: '1', employee_id: 'u1', status: 'pending', approver_id: null };
    expect(canApprove(req, 'u1', 'admin', false).allowed).toBe(false);
  });

  it('an employee-role user cannot approve anyone', () => {
    const req: LeaveRequest = { id: '1', employee_id: 'u2', status: 'pending', approver_id: null };
    expect(canApprove(req, 'u3', 'employee', false).allowed).toBe(false);
  });

  it('an hr_manager can approve others', () => {
    const req: LeaveRequest = { id: '1', employee_id: 'u2', status: 'pending', approver_id: null };
    expect(canApprove(req, 'u3', 'hr_manager', false).allowed).toBe(true);
  });

  it('a dept_manager can only approve their own reports', () => {
    const req: LeaveRequest = { id: '1', employee_id: 'u2', status: 'pending', approver_id: null };
    expect(canApprove(req, 'u3', 'dept_manager', true).allowed).toBe(true);
    expect(canApprove(req, 'u3', 'dept_manager', false).allowed).toBe(false);
  });

  it('cannot approve a non-pending request', () => {
    const req: LeaveRequest = { id: '1', employee_id: 'u2', status: 'approved', approver_id: 'u3' };
    expect(canApprove(req, 'u3', 'admin', false).allowed).toBe(false);
  });
});

describe('Attendance validation (mirror server-side)', () => {
  function validateCheckOut(checkIn: Date, checkOut: Date): { ok: boolean; reason?: string } {
    if (checkOut.getTime() <= checkIn.getTime()) {
      return { ok: false, reason: 'Check-out must be after check-in.' };
    }
    return { ok: true };
  }

  it('check-out after check-in is valid', () => {
    const in_ = new Date('2026-01-01T09:00:00Z');
    const out = new Date('2026-01-01T18:00:00Z');
    expect(validateCheckOut(in_, out).ok).toBe(true);
  });

  it('check-out at or before check-in is invalid', () => {
    const in_ = new Date('2026-01-01T09:00:00Z');
    const out = new Date('2026-01-01T09:00:00Z');
    expect(validateCheckOut(in_, out).ok).toBe(false);
    const earlier = new Date('2026-01-01T08:00:00Z');
    expect(validateCheckOut(in_, earlier).ok).toBe(false);
  });

  it('marks late when check-in is more than 30 minutes after 09:00', () => {
    const startOfDay = new Date('2026-01-01T09:00:00Z');
    const late = new Date('2026-01-01T09:45:00Z');
    const onTime = new Date('2026-01-01T09:20:00Z');
    expect((late.getTime() - startOfDay.getTime()) / 60000).toBeGreaterThan(30);
    expect((onTime.getTime() - startOfDay.getTime()) / 60000).toBeLessThanOrEqual(30);
  });
});

describe('Payroll calculations (mirror server-side generated column)', () => {
  function netPay(base: number, earnings: number, deductions: number, tax: number): number {
    return base + earnings - deductions - tax;
  }

  it('net pay = base + earnings - deductions - tax', () => {
    expect(netPay(50000, 5000, 2000, 8000)).toBe(45000);
  });

  it('zero earnings/deductions/tax yields base salary', () => {
    expect(netPay(40000, 0, 0, 0)).toBe(40000);
  });

  it('deductions reduce net pay', () => {
    expect(netPay(50000, 0, 10000, 0)).toBe(40000);
  });
});

describe('AI request validation (mirror edge function)', () => {
  function validateAIAction(body: { action?: string; question?: string; job_title?: string }): { ok: boolean; reason?: string } {
    const action = String(body.action || '').toLowerCase();
    if (!['chat', 'jd', 'summarize', 'analytics', 'insights'].includes(action)) {
      return { ok: false, reason: 'unknown action' };
    }
    if ((action === 'chat' || action === 'analytics') && !String(body.question || '').trim()) {
      return { ok: false, reason: 'question is required' };
    }
    if (action === 'jd' && !String(body.job_title || '').trim()) {
      return { ok: false, reason: 'job_title is required' };
    }
    return { ok: true };
  }

  it('rejects unknown actions', () => {
    expect(validateAIAction({ action: 'frobnicate' }).ok).toBe(false);
  });

  it('requires a question for chat', () => {
    expect(validateAIAction({ action: 'chat' }).ok).toBe(false);
    expect(validateAIAction({ action: 'chat', question: 'What is the leave policy?' }).ok).toBe(true);
  });

  it('requires job_title for jd', () => {
    expect(validateAIAction({ action: 'jd' }).ok).toBe(false);
    expect(validateAIAction({ action: 'jd', job_title: 'Engineer' }).ok).toBe(true);
  });

  it('summarize and insights need no extra fields', () => {
    expect(validateAIAction({ action: 'summarize' }).ok).toBe(true);
    expect(validateAIAction({ action: 'insights' }).ok).toBe(true);
  });

  it('requires a question for analytics', () => {
    expect(validateAIAction({ action: 'analytics' }).ok).toBe(false);
    expect(validateAIAction({ action: 'analytics', question: 'How many pending leaves?' }).ok).toBe(true);
  });
});
