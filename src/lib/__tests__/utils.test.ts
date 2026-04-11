import { describe, it, expect } from 'vitest';
import { computeStatus, computeNextDueDate } from '../utils';

describe('computeStatus', () => {
  it('returns "overdue" when nextDueDate < today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const nextDueDate = yesterday.toISOString().split('T')[0];
    
    expect(computeStatus(nextDueDate)).toBe('overdue');
  });

  it('returns "current" when completed >= dueDate && dueDate >= today (fix from High Priority #7)', () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Completed today, due tomorrow - completed < dueDate, so NOT current
    expect(computeStatus(tomorrowStr, todayStr)).toBe('upcoming');
    
    // Completed tomorrow, due tomorrow - should be current (completed >= dueDate && dueDate >= today)
    expect(computeStatus(tomorrowStr, tomorrowStr)).toBe('current');
  });

  it('returns "upcoming" when nextDueDate is today', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    expect(computeStatus(todayStr)).toBe('upcoming');
  });

  it('returns "upcoming" when nextDueDate is within 7 days', () => {
    const inFiveDays = new Date();
    inFiveDays.setDate(inFiveDays.getDate() + 5);
    const dueDate = inFiveDays.toISOString().split('T')[0];
    
    expect(computeStatus(dueDate)).toBe('upcoming');
  });

  it('returns "current" when nextDueDate is more than 7 days away and not completed', () => {
    const inTenDays = new Date();
    inTenDays.setDate(inTenDays.getDate() + 10);
    const dueDate = inTenDays.toISOString().split('T')[0];
    
    expect(computeStatus(dueDate)).toBe('current');
  });

  it('handles edge case: due today, completed today', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Due today, completed today = current (completed >= dueDate [TRUE] && dueDate >= today [TRUE])
    expect(computeStatus(todayStr, todayStr)).toBe('current');
  });

  it('handles edge case: overdue obligation that was completed', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Due yesterday, completed yesterday - should be overdue (not current because dueDate < today)
    expect(computeStatus(yesterdayStr, yesterdayStr)).toBe('overdue');
  });

  describe('one-time and event-triggered terminal completion', () => {
    it('one-time obligation completed before due date is "completed" (not "current")', () => {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const today = new Date();
      const nextMonthStr = nextMonth.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      expect(computeStatus(nextMonthStr, todayStr, 'one-time')).toBe('completed');
    });

    it('one-time obligation completed after original due date stays "completed" (not "overdue")', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const today = new Date();
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      // Originally due yesterday, completed today — one-time so it's done forever
      expect(computeStatus(yesterdayStr, todayStr, 'one-time')).toBe('completed');
    });

    it('event-triggered obligation with lastCompletedDate is "completed"', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(computeStatus(today, today, 'event-triggered')).toBe('completed');
    });

    it('one-time obligation without lastCompletedDate is NOT "completed"', () => {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      // Not yet completed — should not return "completed"
      expect(computeStatus(nextMonthStr, null, 'one-time')).toBe('current');
    });

    it('recurring annual obligation completed before due stays "current" (recurring not done forever)', () => {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const today = new Date();
      const nextMonthStr = nextMonth.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      // Annual frequency — completion is for this period, next period still comes
      expect(computeStatus(nextMonthStr, todayStr, 'annual')).toBe('current');
    });
  });
});

describe('computeNextDueDate', () => {
  it('annual frequency adds 1 year', () => {
    const start = '2024-03-15';
    const next = computeNextDueDate(start, 'annual');
    expect(next).toBe('2025-03-15');
  });

  it('quarterly frequency adds 3 months', () => {
    const start = '2024-01-31';
    const next = computeNextDueDate(start, 'quarterly');
    // JavaScript handles month overflow
    expect(next).toBe('2024-05-01'); // Jan 31 + 3 months = Apr 31 -> May 1
  });

  it('monthly frequency adds 1 month', () => {
    const start = '2024-02-29'; // Leap year
    const next = computeNextDueDate(start, 'monthly');
    expect(next).toBe('2024-03-29'); // Feb 29 + 1 month = Mar 29
  });

  it('weekly frequency adds 7 days', () => {
    const start = '2024-03-01';
    const next = computeNextDueDate(start, 'weekly');
    expect(next).toBe('2024-03-08');
  });

  it('handles leap years correctly', () => {
    const start = '2024-02-29'; // Leap year
    const next = computeNextDueDate(start, 'annual');
    expect(next).toBe('2025-03-01'); // 2025 is not a leap year, Feb 29 -> Mar 1
  });

  it('defaults to annual for unknown frequency', () => {
    const start = '2024-03-15';
    const next = computeNextDueDate(start, 'unknown-frequency');
    expect(next).toBe('2025-03-15');
  });
});
