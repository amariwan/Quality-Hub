import { formatBytes } from '@/lib/utils';

describe('formatBytes', () => {
  it('returns a zero string for non-positive values', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(-1)).toBe('0 Bytes');
  });

  it('formats bytes using decimal units', () => {
    expect(formatBytes(1536, { decimals: 1 })).toBe('1.5 KB');
  });

  it('formats bytes using binary units', () => {
    expect(formatBytes(1024, { decimals: 2, sizeType: 'accurate' })).toBe(
      '1.00 KiB'
    );
  });
});
