import { describe, it, expect } from 'vitest';
import { parseRoute, navigate } from '@/lib/router';

describe('Router: hash route parsing', () => {
  it('parses a simple page', () => {
    expect(parseRoute('#/dashboard')).toEqual({ page: 'dashboard', params: [] });
  });

  it('parses a page with params (employee detail)', () => {
    expect(parseRoute('#/employees/abc-123')).toEqual({
      page: 'employees',
      params: ['abc-123'],
    });
  });

  it('defaults to dashboard for empty hash', () => {
    expect(parseRoute('')).toEqual({ page: 'dashboard', params: [] });
    expect(parseRoute('#')).toEqual({ page: 'dashboard', params: [] });
  });

  it('parses multiple params', () => {
    expect(parseRoute('#/leave/123/edit')).toEqual({
      page: 'leave',
      params: ['123', 'edit'],
    });
  });

  it('navigate prepends # if missing', () => {
    // navigate mutates window.location.hash; in jsdom this is observable.
    navigate('/test-page');
    expect(window.location.hash).toBe('#/test-page');
  });
});
