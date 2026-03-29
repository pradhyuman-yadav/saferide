/**
 * SafeRide — "Jade Pebble Morning" color system
 * Source of truth: saferide_brand_guidelines.html
 * Never hardcode hex values elsewhere — always import from here.
 */

export const colors = {
  // ── Primary palette ──────────────────────────────────────
  sage:   '#7B9669', // Primary brand · buttons · active states
  forest: '#404E3B', // Headers · text · CTAs · depth
  mist:   '#BAC8B1', // Cards · secondary backgrounds
  slate:  '#6C8480', // Accent · meta text · icons
  stone:  '#E6E6E6', // Base · whitespace · dividers
  gold:   '#C2A878', // Premium highlights · alerts · warmth
  white:  '#F9F8F5', // Surfaces
  ink:    '#2A2A2A', // Dark text

  // ── Semantic aliases ──────────────────────────────────────
  primary:     '#7B9669', // sage
  background:  '#F9F8F5', // white
  surface:     '#FFFFFF',
  text:        '#2A2A2A', // ink
  textMuted:   '#6C8480', // slate
  textLight:   '#BAC8B1', // mist
  border:      '#E6E6E6', // stone
  alert:       '#C2A878', // gold — never use red

  // ── Alpha variants (for overlays, badges) ────────────────
  sageAlpha18:  'rgba(123,150,105,0.18)',
  sageAlpha25:  'rgba(123,150,105,0.25)',
  forestAlpha12: 'rgba(64,78,59,0.12)',
  goldAlpha20:  'rgba(194,168,120,0.20)',
  slateAlpha15: 'rgba(108,132,128,0.15)',

  // ── Badge fill colors ─────────────────────────────────────
  badgeActiveBg:  'rgba(123,150,105,0.18)',
  badgeActiveFg:  '#404E3B',
  badgeAlertBg:   'rgba(194,168,120,0.20)',
  badgeAlertFg:   '#7A5C1E',
  badgeMutedBg:   'rgba(108,132,128,0.15)',
  badgeMutedFg:   '#6C8480',
} as const;

export type ColorKey = keyof typeof colors;
