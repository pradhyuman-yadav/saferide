import { typography, fontFamily } from '@/theme/typography';

describe('fontFamily', () => {
  it('exports serif and sans font identifiers', () => {
    expect(fontFamily.serifDisplay).toBe('DMSerifDisplay_400Regular');
    expect(fontFamily.sansRegular).toBe('DMSans_400Regular');
    expect(fontFamily.sansMedium).toBe('DMSans_500Medium');
    expect(fontFamily.sansLight).toBe('DMSans_300Light');
  });
});

describe('typography scale', () => {
  const REQUIRED_VARIANTS = [
    'display', 'heading', 'subheading', 'body', 'caption', 'label', 'data', 'cardTitle', 'statNum',
  ] as const;

  it.each(REQUIRED_VARIANTS)('%s variant is defined', (variant) => {
    expect(typography[variant]).toBeDefined();
  });

  it.each(REQUIRED_VARIANTS)('%s has fontFamily, fontSize, fontWeight, lineHeight', (variant) => {
    const t = typography[variant];
    expect(t.fontFamily).toBeDefined();
    expect(t.fontSize).toBeGreaterThan(0);
    expect(t.fontWeight).toBeDefined();
    expect(t.lineHeight).toBeGreaterThan(0);
  });

  it('no font weight exceeds 500 (brand rule: 500 is maximum)', () => {
    Object.values(typography).forEach((t) => {
      const weight = parseInt(String(t.fontWeight), 10);
      if (!isNaN(weight)) {
        expect(weight).toBeLessThanOrEqual(500);
      }
    });
  });

  it('display font is larger than heading font', () => {
    expect(typography.display.fontSize).toBeGreaterThan(typography.heading.fontSize);
  });

  it('body font is larger than caption font', () => {
    expect(typography.body.fontSize).toBeGreaterThan(typography.caption.fontSize);
  });

  it('display uses serif font', () => {
    expect(typography.display.fontFamily).toBe(fontFamily.serifDisplay);
  });

  it('body uses sans font', () => {
    expect(typography.body.fontFamily).toBe(fontFamily.sansRegular);
  });

  it('subheading has uppercase transform', () => {
    expect(typography.subheading.textTransform).toBe('uppercase');
  });
});
