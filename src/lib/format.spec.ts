import { formatDate } from '@/lib/format';

describe('formatDate', () => {
  it('returns an empty string when date is missing', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('formats a valid date with deterministic timezone output', () => {
    expect(
      formatDate('2026-01-02T00:00:00.000Z', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
      })
    ).toBe('Jan 02, 2026');
  });

  it('returns an empty string for invalid values', () => {
    expect(formatDate('invalid-date')).toBe('');
  });
});
