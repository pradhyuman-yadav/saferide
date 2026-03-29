import { spacing, radius, iconSize } from '@/theme/spacing';

describe('spacing scale', () => {
  it('all values are positive integers', () => {
    Object.values(spacing).forEach((v) => {
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it('all values are multiples of 4 (base-4 rule)', () => {
    Object.values(spacing).forEach((v) => {
      expect(v % 4).toBe(0);
    });
  });

  it('has base values 4, 8, 16, 24, 32, 48, 64', () => {
    const vals = Object.values(spacing);
    [4, 8, 16, 24, 32, 48, 64].forEach((expected) => {
      expect(vals).toContain(expected);
    });
  });

  it('values are in ascending order', () => {
    const vals = Object.values(spacing);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});

describe('radius scale', () => {
  it('has xs through full variants', () => {
    expect(radius.xs).toBeDefined();
    expect(radius.sm).toBeDefined();
    expect(radius.md).toBeDefined();
    expect(radius.lg).toBeDefined();
    expect(radius.xl).toBeDefined();
    expect(radius.full).toBe(999);
  });

  it('all values are positive', () => {
    Object.values(radius).forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

describe('iconSize', () => {
  it('standard (lg) icon is 24px per brand guidelines', () => {
    expect(iconSize.lg).toBe(24);
  });

  it('all sizes are positive multiples of 4', () => {
    Object.values(iconSize).forEach((v) => {
      expect(v).toBeGreaterThan(0);
      expect(v % 4).toBe(0);
    });
  });
});
