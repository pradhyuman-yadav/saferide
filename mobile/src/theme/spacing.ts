/**
 * SafeRide spacing scale — base-4
 * Prefer multiples of 8 for layout.
 * Never use arbitrary values like 13 or 22.
 */

export const spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  xs:   5,
  sm:   8,
  md:   10,
  lg:   12,
  xl:   14,
  xxl:  16,
  full: 999,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24, // standard
  xl: 32,
} as const;
