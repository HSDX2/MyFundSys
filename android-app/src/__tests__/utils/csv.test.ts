import { describe, it, expect } from '@jest/globals';
import { formatLocalDate } from '../../utils/csv';

describe('formatLocalDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2024, 0, 15))).toBe('2024-01-15');
  });

  it('pads month and day with leading zeros', () => {
    expect(formatLocalDate(new Date(2024, 2, 5))).toBe('2024-03-05');
  });

  it('handles year boundary', () => {
    expect(formatLocalDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });
});
