/**
 * SafeRide typography scale
 * Fonts: DM Serif Display (headings) + DM Sans (UI)
 * Loaded via @expo-google-fonts in app/_layout.tsx
 */

export const fontFamily = {
  serifDisplay: 'DMSerifDisplay_400Regular',
  sansRegular:  'DMSans_400Regular',
  sansMedium:   'DMSans_500Medium',
  sansLight:    'DMSans_300Light',
} as const;

export const typography = {
  // ── Display — emotional moments, hero headlines ───────────
  display: {
    fontFamily: fontFamily.serifDisplay,
    fontSize:   38,
    fontWeight: '400' as const,
    lineHeight: 42,
    letterSpacing: -0.76, // -0.02em at 38px
  },

  // ── Heading — section titles ──────────────────────────────
  heading: {
    fontFamily: fontFamily.serifDisplay,
    fontSize:   24,
    fontWeight: '400' as const,
    lineHeight: 30,
    letterSpacing: 0,
  },

  // ── Subheading — UI labels, tracked uppercase ─────────────
  subheading: {
    fontFamily: fontFamily.sansMedium,
    fontSize:   14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0.84, // 0.06em at 14px
    textTransform: 'uppercase' as const,
  },

  // ── Body — all copy ───────────────────────────────────────
  body: {
    fontFamily: fontFamily.sansRegular,
    fontSize:   14,
    fontWeight: '400' as const,
    lineHeight: 23.8, // 1.7 line-height
    letterSpacing: 0.14,
  },

  // ── Caption — timestamps, metadata, supporting info ───────
  caption: {
    fontFamily: fontFamily.sansRegular,
    fontSize:   11,
    fontWeight: '400' as const,
    lineHeight: 16.5, // 1.5 line-height
    letterSpacing: 0.22,
  },

  // ── Label — small UI labels (tab bars, badges) ────────────
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize:   10,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
  },

  // ── Data — bus IDs, ETAs, speeds (monospace-style) ────────
  data: {
    fontFamily: fontFamily.sansMedium,
    fontSize:   12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0,
  },

  // ── Card title (UI card headings) ─────────────────────────
  cardTitle: {
    fontFamily: fontFamily.serifDisplay,
    fontSize:   20,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
  },

  // ── Stat number (dashboard metrics) ──────────────────────
  statNum: {
    fontFamily: fontFamily.serifDisplay,
    fontSize:   26,
    fontWeight: '400' as const,
    lineHeight: 30,
    letterSpacing: 0,
  },
} as const;
