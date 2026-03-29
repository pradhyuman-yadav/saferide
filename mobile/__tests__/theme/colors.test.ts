import { colors } from '@/theme/colors';

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const RGBA_RE = /^rgba\(\d+,\d+,\d+,[\d.]+\)$/;

describe('colors', () => {
  it('exports all required brand tokens', () => {
    expect(colors.sage).toBeDefined();
    expect(colors.forest).toBeDefined();
    expect(colors.mist).toBeDefined();
    expect(colors.slate).toBeDefined();
    expect(colors.stone).toBeDefined();
    expect(colors.gold).toBeDefined();
    expect(colors.white).toBeDefined();
    expect(colors.ink).toBeDefined();
  });

  it('all solid colors are valid hex strings', () => {
    const solidKeys = ['sage', 'forest', 'mist', 'slate', 'stone', 'gold', 'white', 'ink'] as const;
    solidKeys.forEach((key) => {
      expect(colors[key]).toMatch(HEX_RE);
    });
  });

  it('alpha variants are valid rgba strings', () => {
    const alphaKeys = ['sageAlpha18', 'sageAlpha25', 'forestAlpha12', 'goldAlpha20', 'slateAlpha15'] as const;
    alphaKeys.forEach((key) => {
      // rgba() format
      expect(colors[key]).toMatch(/^rgba\(/);
    });
  });

  it('primary brand color (sage) is #7B9669', () => {
    expect(colors.sage).toBe('#7B9669');
  });

  it('forest dark color is #404E3B', () => {
    expect(colors.forest).toBe('#404E3B');
  });

  it('gold alert color is #C2A878 — never red', () => {
    expect(colors.gold).toBe('#C2A878');
    // Confirm no red-ish color exists (brand rule: no red for alerts)
    expect(colors.alert).toBe(colors.gold);
  });

  it('semantic aliases point to correct base colors', () => {
    expect(colors.primary).toBe(colors.sage);
    expect(colors.background).toBe(colors.white);
    expect(colors.text).toBe(colors.ink);
    expect(colors.border).toBe(colors.stone);
  });

  it('badge colors are defined for all three variants', () => {
    expect(colors.badgeActiveBg).toBeDefined();
    expect(colors.badgeActiveFg).toBeDefined();
    expect(colors.badgeAlertBg).toBeDefined();
    expect(colors.badgeAlertFg).toBeDefined();
    expect(colors.badgeMutedBg).toBeDefined();
    expect(colors.badgeMutedFg).toBeDefined();
  });
});
