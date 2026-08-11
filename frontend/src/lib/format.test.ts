import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, formatMoney, plural, statusClass } from './format';

describe('format helpers', () => {
  it('formats money from Prisma Decimal strings', () => {
    expect(formatMoney('2.50')).toBe('$2.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('formats dates and handles missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('2026-08-11T12:00:00Z')).toMatch(/2026/);
  });

  it('computes whole days until a date (negative → past)', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(daysUntil(future)).toBe(3);
    expect(daysUntil(past)).toBe(-2);
  });

  it('pluralises words', () => {
    expect(plural(1, 'loan')).toBe('1 loan');
    expect(plural(2, 'loan')).toBe('2 loans');
  });

  it('maps statuses to tailwind pill classes', () => {
    expect(statusClass('ACTIVE')).toContain('emerald');
    expect(statusClass('SUSPENDED')).toContain('red');
    expect(statusClass('unknown-value')).toContain('slate');
  });
});
