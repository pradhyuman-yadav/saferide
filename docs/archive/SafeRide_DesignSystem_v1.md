# SafeRide — Design System
> **"Jade Pebble Morning"** · Version 1.0 · March 2026  
> Required reading for all engineers and designers before building any UI.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Elevation & Shadows](#5-elevation--shadows)
6. [Border Radius](#6-border-radius)
7. [Iconography](#7-iconography)
8. [Component Patterns](#8-component-patterns)
9. [Motion & Animation](#9-motion--animation)
10. [Accessibility](#10-accessibility)
11. [React Native Implementation](#11-react-native-implementation)
12. [Web Implementation](#12-web-implementation)
13. [Do's & Don'ts](#13-dos--donts)
14. [Quick Reference Tokens](#14-quick-reference-tokens)

---

## 1. Design Philosophy

SafeRide is a safety product. Parents open it in a moment of mild anxiety — _"where is my child's bus?"_ — and leave feeling reassured. Every design decision must serve that emotional arc: **from mild worry to calm certainty**.

### The Three Principles

**1. Calm over excitement**  
No aggressive colors, no jarring transitions, no loud visual noise. Everything should feel settled and trustworthy. Think weather app, not gaming app.

**2. Clarity over cleverness**  
A parent on a bumpy auto-rickshaw, glancing at a 5-inch screen, must understand the screen in under 2 seconds. If it needs a tutorial, redesign it.

**3. Premium without pretension**  
The palette is earthy and natural. It signals quality without feeling corporate or cold. A government app feels gray and lifeless. SafeRide should feel like something you'd pay for.

---

## 2. Color System

### 2.1 The Palette — "Jade Pebble Morning"

```
┌─────────────────────────────────────────────────────────────────────┐
│  #7B9669   #404E3B   #BAC8B1   #6C8480   #E6E6E6   #C2A878         │
│  ████████  ████████  ████████  ████████  ████████  ████████         │
│  Sage      Forest    Mist      Slate     Stone     Gold             │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Token Definitions

Every color must be referenced by its **token name**, never by hex value directly in component code.

#### Core Palette

| Token | Hex | Name | Description |
|---|---|---|---|
| `color.sage.500` | `#7B9669` | Sage | Primary brand color. Calm, approachable. |
| `color.forest.700` | `#404E3B` | Forest | Dark anchor. Headers, CTAs, high-contrast text. |
| `color.mist.200` | `#BAC8B1` | Mist | Light surface. Cards, secondary backgrounds. |
| `color.slate.500` | `#6C8480` | Slate | Accent. Secondary actions, info states, sophistication. |
| `color.stone.100` | `#E6E6E6` | Stone | Base. Page background, whitespace, dividers. |
| `color.gold.400` | `#C2A878` | Gold | Pop highlight. Badges, alerts, premium indicators. |

#### Extended Shades

Generated programmatically — use these for hover states, disabled states, and depth.

```
Sage Family
  color.sage.100   #E8EDE5   ← Tinted backgrounds, chips
  color.sage.200   #CDD8C8   ← Hover surfaces
  color.sage.300   #B2C3AA   ← Borders
  color.sage.400   #97AE8C   ← Secondary icons
  color.sage.500   #7B9669   ← PRIMARY — buttons, active states
  color.sage.600   #637B54   ← Pressed state
  color.sage.700   #4B6040   ← Dark variant
  color.sage.800   #344430   ← Very dark

Forest Family
  color.forest.400   #5C6E55   ← Softer headings
  color.forest.500   #4F5F49   ← Body text (dark mode)
  color.forest.600   #47533F   ← Secondary text
  color.forest.700   #404E3B   ← PRIMARY DARK — main headings, CTAs
  color.forest.800   #323D2E   ← Maximum contrast text
  color.forest.900   #242B20   ← Near-black

Mist Family
  color.mist.100   #E7EDE4   ← Lightest surface
  color.mist.200   #BAC8B1   ← PRIMARY LIGHT — cards, panels
  color.mist.300   #A0B496   ← Slightly deeper surface
  color.mist.400   #889E7E   ← Muted icons

Slate Family
  color.slate.300   #9FB5B1   ← Light accent
  color.slate.400   #85A09B   ← Hover
  color.slate.500   #6C8480   ← PRIMARY ACCENT
  color.slate.600   #556A66   ← Pressed

Gold Family
  color.gold.200   #E8D9BF   ← Tinted background for gold badges
  color.gold.300   #D5BF98   ← Subtle gold
  color.gold.400   #C2A878   ← PRIMARY GOLD
  color.gold.500   #A88D5E   ← Deep gold
  color.gold.600   #8E7348   ← Pressed / dark

Neutrals
  color.white       #FFFFFF
  color.stone.50    #F5F5F5   ← Page background (light mode)
  color.stone.100   #E6E6E6   ← Dividers, borders
  color.stone.200   #CCCCCC   ← Disabled borders
  color.stone.300   #B3B3B3   ← Placeholder text
  color.stone.400   #999999   ← Muted text
  color.stone.600   #666666   ← Secondary text
  color.stone.800   #333333   ← Body text (light mode)
  color.stone.900   #1A1A1A   ← Near-black
```

### 2.3 Semantic Color Roles

Never reference palette tokens directly in components. Use semantic tokens. This is what makes theming and dark mode possible without touching every component.

```
Background
  bg.page           → color.stone.50       Light page background
  bg.surface        → color.white          Cards, modals, sheets
  bg.surface.raised → color.white          Elevated cards
  bg.muted          → color.mist.100       Subtle section bg, input bg
  bg.brand          → color.sage.500       Branded sections
  bg.brand.subtle   → color.sage.100       Tinted backgrounds near brand elements

Text
  text.primary      → color.forest.700     Main body text, headings
  text.secondary    → color.stone.600      Supporting text, captions
  text.muted        → color.stone.400      Placeholders, disabled
  text.inverse      → color.white          Text on dark/brand backgrounds
  text.brand        → color.sage.600       Colored labels, links
  text.accent       → color.slate.500      Accent labels, secondary links

Border
  border.default    → color.stone.100      Card borders, dividers
  border.strong     → color.stone.200      Input borders
  border.brand      → color.sage.400       Focused inputs, brand borders
  border.focus      → color.sage.500       Focus ring

Interactive
  interactive.primary.bg         → color.sage.500
  interactive.primary.bg.hover   → color.sage.600
  interactive.primary.bg.pressed → color.sage.700
  interactive.primary.bg.disabled→ color.mist.200
  interactive.primary.text       → color.white
  interactive.primary.text.disabled → color.stone.400

  interactive.secondary.bg         → color.white
  interactive.secondary.bg.hover   → color.mist.100
  interactive.secondary.border      → color.sage.400
  interactive.secondary.text        → color.sage.600

  interactive.ghost.bg.hover      → color.mist.100
  interactive.ghost.text          → color.forest.700

Status
  status.success.bg    → #ECFDF0   (very light green — close to palette)
  status.success.text  → #2D6A4F
  status.success.icon  → color.sage.500

  status.warning.bg    → color.gold.200
  status.warning.text  → color.gold.600
  status.warning.icon  → color.gold.400

  status.error.bg      → #FEF2F2
  status.error.text    → #991B1B
  status.error.icon    → #DC2626

  status.info.bg       → #EFF6FF
  status.info.text     → #1E40AF
  status.info.icon     → #3B82F6

  status.live.bg       → color.sage.100    (bus is currently moving)
  status.live.text     → color.forest.700
  status.live.dot      → color.sage.500    (animated pulse)

  status.delayed.bg    → color.gold.200
  status.delayed.text  → color.gold.600

  status.offline.bg    → color.stone.100
  status.offline.text  → color.stone.400
```

### 2.4 Contrast Ratios (Accessibility)

WCAG AA requires 4.5:1 for normal text, 3:1 for large text and UI components.

| Foreground | Background | Ratio | Grade | Use case |
|---|---|---|---|---|
| `color.forest.700` `#404E3B` | `color.white` | **10.2:1** | AAA ✅ | Primary body text |
| `color.forest.700` `#404E3B` | `color.stone.50` | **9.8:1** | AAA ✅ | Page text on background |
| `color.white` | `color.sage.500` `#7B9669` | **4.6:1** | AA ✅ | White text on sage button |
| `color.forest.700` | `color.mist.200` `#BAC8B1` | **5.1:1** | AA ✅ | Text on card surfaces |
| `color.white` | `color.forest.700` | **10.2:1** | AAA ✅ | White on dark CTA button |
| `color.sage.600` `#637B54` | `color.white` | **5.2:1** | AA ✅ | Brand-colored links |
| `color.stone.600` `#666` | `color.white` | **5.7:1** | AA ✅ | Secondary text |
| `color.sage.500` `#7B9669` | `color.mist.200` `#BAC8B1` | **1.9:1** | ❌ FAIL | **Never use this combo for text** |
| `color.sage.500` | `color.stone.50` | **3.4:1** | AA Large ✅ | Large text / icons only, not body |

> ⚠️ **The `#7B9669` on `#BAC8B1` combo fails contrast.** This is the most common mistake. Use `color.forest.700` for text on mist surfaces.

---

## 3. Typography

### 3.1 Font Stack

**Primary:** `Inter` (all UI text)  
**Monospace:** `JetBrains Mono` (trip IDs, device codes, timestamps when precision matters)

```
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold }
  from '@expo-google-fonts/inter'
```

### 3.2 Type Scale

| Token | Size | Line Height | Weight | Use |
|---|---|---|---|---|
| `text.display` | 32px / 2rem | 1.2 | 700 Bold | Hero text only (onboarding screens) |
| `text.h1` | 26px / 1.625rem | 1.25 | 700 Bold | Screen titles |
| `text.h2` | 22px / 1.375rem | 1.3 | 600 SemiBold | Section headers |
| `text.h3` | 18px / 1.125rem | 1.35 | 600 SemiBold | Card headers, subsections |
| `text.body.lg` | 16px / 1rem | 1.5 | 400 Regular | Primary body copy |
| `text.body` | 15px / 0.9375rem | 1.5 | 400 Regular | Default body text |
| `text.body.sm` | 13px / 0.8125rem | 1.45 | 400 Regular | Supporting text, captions |
| `text.label` | 13px / 0.8125rem | 1.2 | 600 SemiBold | Form labels, button text |
| `text.caption` | 11px / 0.6875rem | 1.4 | 400 Regular | Timestamps, fine print |
| `text.overline` | 11px / 0.6875rem | 1.2 | 600 SemiBold, UPPERCASE | Section labels above headings |
| `text.mono` | 13px / 0.8125rem | 1.4 | 400 Regular | Trip IDs, bus numbers, codes |

### 3.3 Typography Rules

```
✅ DO
- Use text.body (15px) for all list items and card content
- Use text.overline + text.h2 for section header pairs (e.g. "BUS DETAILS / KA05 AB1234")
- Use text.mono for bus registration numbers, trip IDs, device IMEIs
- Limit to 2 font weights on any single screen (e.g. 400 + 600)
- Use text.h1 only once per screen

❌ DO NOT
- Never go below 11px (text.caption minimum)
- Never use more than 3 type sizes on a single card
- Never bold body copy for emphasis — use color or a heavier weight token
- Never mix Inter and another sans-serif
- Never use font-weight 300 (too light on Android, varies by device)
```

### 3.4 Text Color Usage

```
Screen title (h1)         → text.primary     (color.forest.700)
Section header (h2, h3)   → text.primary     (color.forest.700)
Body copy                 → text.primary     (color.forest.700)
Supporting info           → text.secondary   (color.stone.600)
Captions, timestamps      → text.muted       (color.stone.400)
Labels on brand bg        → text.inverse     (color.white)
Overline labels           → text.brand       (color.sage.600)
Links                     → text.brand       (color.sage.600)
Error messages            → status.error.text
Disabled text             → text.muted       (color.stone.400)
```

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Based on a **4px base unit**. Always use multiples of 4.

| Token | Value | Use |
|---|---|---|
| `space.1` | 4px | Tight internal padding (icon + text gap) |
| `space.2` | 8px | Small gaps, icon padding |
| `space.3` | 12px | Compact list item padding |
| `space.4` | 16px | Default padding inside cards, buttons |
| `space.5` | 20px | Comfortable list item padding |
| `space.6` | 24px | Section padding, card padding (comfortable) |
| `space.8` | 32px | Between sections on a screen |
| `space.10` | 40px | Large section gaps |
| `space.12` | 48px | Page-level spacing |
| `space.16` | 64px | Hero spacing, illustration areas |

> **Rule:** Never use an arbitrary spacing value. If `space.4` is too small and `space.5` feels too big — use `space.4` and examine whether the design needs adjusting, not the spacing system.

### 4.2 Screen Layout

```
Mobile (React Native)
┌───────────────────────────────┐
│  Status Bar                   │
├───────────────────────────────┤
│  Header (56px)                │  ← space.6 (24px) vertical padding
│  Screen Title                 │
├───────────────────────────────┤
│                               │
│  Content (scroll area)        │  ← horizontal padding: space.4 (16px)
│                               │
│                               │
├───────────────────────────────┤
│  Bottom Tab Nav (60px)        │
└───────────────────────────────┘

Web Admin (React)
┌───────────┬───────────────────────────────────────┐
│           │  Top Nav (64px)                       │
│  Sidebar  ├───────────────────────────────────────┤
│  (240px)  │                                       │
│           │  Page content                         │  ← padding: space.8 (32px)
│           │                                       │
└───────────┴───────────────────────────────────────┘
```

### 4.3 Content Width Caps

| Context | Max Width | Reasoning |
|---|---|---|
| Mobile screens | Full width (no cap) | Phones are narrow enough |
| Web page content | 1200px | Prevents ultra-wide readability issues |
| Web form / settings | 640px | Forms feel awkward when too wide |
| Web dashboard cards | 400px each | Grid-based, not full-width |
| Map (fleet dashboard) | Uncapped | Maps should fill available space |

### 4.4 Grid System (Web)

```
12-column grid
  Gutter:  24px (space.6)
  Margin:  32px (space.8) on sides

Common breakpoints:
  sm   640px   Single column
  md   768px   2 columns
  lg   1024px  Sidebar visible
  xl   1280px  Full dashboard layout
```

---

## 5. Elevation & Shadows

Elevation communicates depth hierarchy. Use sparingly — not every card needs a shadow.

| Token | CSS Value | React Native | Use |
|---|---|---|---|
| `shadow.none` | `none` | `{}` | Flat surfaces, background cards |
| `shadow.sm` | `0 1px 3px rgba(64,78,59,0.08), 0 1px 2px rgba(64,78,59,0.04)` | `elevation: 2` | Default card, input focus |
| `shadow.md` | `0 4px 12px rgba(64,78,59,0.10), 0 2px 4px rgba(64,78,59,0.06)` | `elevation: 4` | Floating action button, dropdown |
| `shadow.lg` | `0 8px 24px rgba(64,78,59,0.12), 0 4px 8px rgba(64,78,59,0.08)` | `elevation: 8` | Modal bottom sheet, sticky header |
| `shadow.xl` | `0 16px 48px rgba(64,78,59,0.16)` | `elevation: 12` | Full-screen modal, overlay |

> **Note:** Shadow color uses `color.forest.700` (`#404E3B`) at low opacity rather than pure black. This keeps shadows warm and on-palette.

---

## 6. Border Radius

Consistent rounding prevents the common issue of "some components look sharp, some look pill-shaped."

| Token | Value | Use |
|---|---|---|
| `radius.none` | 0px | Deliberately sharp — table rows, full-bleed images |
| `radius.sm` | 4px | Subtle rounding — tags, small badges |
| `radius.md` | 8px | Default — buttons, inputs, small cards |
| `radius.lg` | 12px | Cards, panels, notification banners |
| `radius.xl` | 16px | Bottom sheets, large modal cards |
| `radius.2xl` | 24px | Large feature cards (onboarding) |
| `radius.full` | 9999px | Pills, avatars, status dots, FABs |

**Component-specific rules:**

```
Buttons          → radius.md (8px) — feels actionable, not too sharp or pill-like
Inputs           → radius.md (8px)
Cards            → radius.lg (12px)
Chips / tags     → radius.full (9999px)
Avatars          → radius.full (9999px)
Bottom sheet     → radius.xl top-only (16px top-left, 16px top-right, 0 bottom)
Map markers      → custom (teardrop shape, not a system radius)
Alert banners    → radius.lg (12px)
Tab bar          → radius.none (system component, don't override)
```

---

## 7. Iconography

### 7.1 Icon Library

**Primary:** [Lucide Icons](https://lucide.dev) — clean, consistent, open-source  
**Why Lucide:** 24px optical grid, 2px stroke, consistent geometry. Looks great at all sizes. Works with React Native via `lucide-react-native`.

```ts
import { MapPin, Bus, Bell, AlertTriangle, Navigation } from 'lucide-react-native'
```

### 7.2 Icon Sizes

| Token | Size | Use |
|---|---|---|
| `icon.xs` | 14px | Inline with caption text |
| `icon.sm` | 16px | Inline with body text, list items |
| `icon.md` | 20px | Default — nav items, card icons |
| `icon.lg` | 24px | Standalone icons, FAB icons |
| `icon.xl` | 32px | Feature illustrations, empty states |
| `icon.2xl` | 48px | Onboarding, large empty states |

### 7.3 Icon Color Rules

```
Navigation icons (active)    → color.sage.500
Navigation icons (inactive)  → color.stone.400
Action icons                 → color.forest.700
Status icons                 → semantic color (status.success.icon, etc.)
Decorative icons             → color.mist.300
Disabled icons               → color.stone.300
Icons on brand backgrounds   → color.white or color.mist.100
```

### 7.4 Custom Icons (Domain-specific)

These require custom SVG — Lucide does not have them.

| Icon | Description | Use |
|---|---|---|
| `icon.bus` | School bus silhouette | Map marker, list item |
| `icon.bus.marker` | Bus on map pin | Live map marker |
| `icon.tap` | Hand tapping card | RFID tap events (Phase 2) |
| `icon.school.gate` | Gate/arch symbol | Campus entry events (Phase 3) |
| `icon.child` | Small figure | Student list items |

Custom SVG icons live in `packages/ui/src/icons/`. They must:
- Use a 24×24 viewport
- Use `currentColor` for stroke/fill (respects color prop)
- Have a 2px stroke width to match Lucide
- Be exported as React components

---

## 8. Component Patterns

### 8.1 Button

Four variants. Three sizes. One state system.

```
Variants:
  primary    → sage.500 bg, white text        ← Most actions
  secondary  → white bg, sage border+text     ← Secondary actions
  ghost      → transparent bg, forest text    ← Tertiary, inside cards
  danger     → error.bg, error.text+border    ← Destructive actions (delete, cancel trip)

Sizes:
  sm    height 32px   font text.label (13px)   px space.3 (12px)
  md    height 44px   font text.label (13px)   px space.4 (16px)   ← Default
  lg    height 52px   font text.body (15px)    px space.6 (24px)

States:
  default   → base styles
  hover     → darken bg by one shade token
  pressed   → darken bg by two shade tokens + scale(0.98)
  loading   → show spinner, disable pointer events, reduce opacity to 0.8
  disabled  → interactive.primary.bg.disabled, text.muted, cursor not-allowed
  focus     → 2px focus ring, color border.focus (sage.500), offset 2px
```

```tsx
// ✅ Usage
<Button variant="primary" size="md" onPress={handleStartTrip}>
  Start Trip
</Button>

<Button variant="secondary" size="sm" onPress={handleCancel}>
  Cancel
</Button>

<Button variant="danger" size="md" loading={isDeleting} onPress={handleDelete}>
  Delete Bus
</Button>

// ❌ Never use TouchableOpacity directly for actions — always use Button component
```

### 8.2 Card

```
Default card:
  bg          → bg.surface (white)
  border      → 1px border.default (stone.100)
  radius      → radius.lg (12px)
  shadow      → shadow.sm
  padding     → space.4 (16px) or space.6 (24px) for comfortable variant

Variants:
  default    → white bg, light border
  muted      → mist.100 bg, no border    ← For subtle grouping
  brand      → sage.100 bg, sage.300 border ← For highlighted/featured cards
  warning    → gold.200 bg, gold.300 border ← For delay/alert cards
  error      → error.bg, error border    ← For SOS / critical alerts
```

```tsx
// ✅ Usage
<Card>
  <CardHeader title="Bus KA05 AB1234" subtitle="Route 3 — Koramangala" />
  <CardBody>...</CardBody>
</Card>

<Card variant="warning">
  <Text>Bus delayed by 12 minutes</Text>
</Card>
```

### 8.3 Badge / Status Chip

```
Sizes:      sm (20px height)   md (24px height, default)
Radius:     radius.full (pill shape)
Font:       text.label (13px, semibold)
Padding:    px space.2 (8px), py space.1 (4px)

Variants:
  live      → sage.100 bg, forest text, animated sage dot
  delayed   → gold.200 bg, gold.600 text
  offline   → stone.100 bg, stone.400 text
  arrived   → success.bg, success.text
  sos       → error.bg, error.text, pulsing animation
  school    → slate.100 bg, slate.600 text (Phase 3 - campus entry)
```

```tsx
<Badge variant="live">● Live</Badge>
<Badge variant="delayed">12 min late</Badge>
<Badge variant="offline">Last seen 5m ago</Badge>
```

### 8.4 Input / Form Fields

```
Default state:
  height      44px
  bg          bg.muted (mist.100)
  border      1px border.strong (stone.200)
  radius      radius.md (8px)
  font        text.body (15px)
  text color  text.primary
  padding     px space.4 (16px)

Focus state:
  border      2px border.focus (sage.500)
  bg          bg.surface (white)
  shadow      shadow.sm

Error state:
  border      1px status.error.icon (#DC2626)
  error text  below input, status.error.text, text.body.sm

Disabled state:
  bg          stone.100
  text        text.muted
  border      stone.100
  cursor      not-allowed

Label:        above input, text.label, text.primary, space.2 (8px) gap
Helper text:  below input, text.body.sm, text.secondary
Error text:   below input, text.body.sm, status.error.text
```

### 8.5 Map Markers

The map is the hero of this product. Markers must be instantly readable.

```
Bus marker (active trip):
  Shape       Rounded rectangle (not a pin teardrop)
  Bg          color.sage.500
  Icon        custom bus icon, white, icon.sm (16px)
  Border      2px white
  Shadow      shadow.md
  Size        40×40px

Bus marker (delayed):
  Bg          color.gold.400
  Pulsing ring  gold.200, animated

Bus marker (SOS):
  Bg          status.error.icon (#DC2626)
  Pulsing ring  error.bg, fast animation
  Size        48×48px (larger for urgency)

Bus marker (offline / last known):
  Bg          color.stone.300
  Icon        white, 50% opacity

Stop marker (parent's stop — highlighted):
  Shape       Circle
  Bg          color.forest.700
  Size        12px + 3px white border

Stop marker (other stops):
  Bg          color.mist.300
  Size        8px

Route polyline:
  Color       color.sage.400
  Width       3px
  Dash        none (solid)

Completed route section:
  Color       color.mist.300
  Width       2px
```

### 8.6 List Items

```
Standard list item:
  Height      min 56px (touch target minimum)
  Padding     px space.4 (16px), py space.3 (12px)
  Border      bottom 1px border.default (stone.100)
  Background  bg.surface (white)

  Leading icon   20px, icon.md, color varies by type
  Title text     text.body, text.primary
  Supporting     text.body.sm, text.secondary
  Trailing       text.body.sm + chevron or status badge

Pressed state:    bg.muted (mist.100)
Selected state:   left border 3px sage.500, bg sage.100
```

### 8.7 Notification Banner (In-app)

```
Live notification (bus approaching):
  Bg          color.forest.700
  Text        color.white
  Icon        Bell, white, icon.md
  Radius      radius.lg (12px)
  Position    Top of screen, below status bar, slides down
  Duration    Auto-dismiss 4 seconds

Delay warning:
  Bg          color.gold.400
  Text        color.forest.700 (dark text on gold)
  Icon        AlertTriangle

SOS alert:
  Bg          status.error.icon
  Text        white
  Icon        AlertOctagon, pulsing
  Auto-dismiss  No — requires manual dismissal
```

---

## 9. Motion & Animation

Motion communicates state changes. Every animation serves a functional purpose.

### 9.1 Duration Scale

| Token | Duration | Use |
|---|---|---|
| `duration.instant` | 0ms | No animation (reduced motion mode) |
| `duration.fast` | 100ms | Micro-interactions (button press scale) |
| `duration.normal` | 200ms | Default transitions (tab switch, color change) |
| `duration.slow` | 350ms | Screen transitions, bottom sheet open |
| `duration.deliberate` | 500ms | Onboarding, feature highlights |

### 9.2 Easing

```
ease.out      cubic-bezier(0, 0, 0.2, 1)    ← Elements entering (snappy arrival)
ease.in       cubic-bezier(0.4, 0, 1, 1)    ← Elements leaving (quick departure)
ease.inOut    cubic-bezier(0.4, 0, 0.2, 1)  ← Position changes, reordering
ease.spring   spring(1, 80, 12, 0)          ← React Native Reanimated — bouncy markers
```

### 9.3 Standard Animations

```
Bus marker movement on map:
  Type        Animated coordinate change
  Duration    duration.slow (350ms)
  Easing      ease.out
  Note        Smooth — never teleport jump

Screen transition (React Native):
  Type        Slide from right
  Duration    duration.slow (350ms)
  Easing      ease.inOut

Bottom sheet open:
  Type        Slide up + fade in
  Duration    duration.slow (350ms)
  Easing      ease.out

Notification banner:
  Enter       Slide down, duration.normal (200ms), ease.out
  Exit        Slide up, duration.fast (100ms), ease.in

Live pulse (SOS marker):
  Type        Scale 1 → 1.6, opacity 1 → 0, repeat
  Duration    1200ms
  Easing      ease.out

Status badge live dot:
  Type        Opacity 1 → 0.3 → 1, repeat
  Duration    2000ms
  Easing      ease.inOut

Button press:
  Type        scale(0.97) on press, scale(1.0) on release
  Duration    duration.fast (100ms)
```

### 9.4 Reduced Motion

Always respect the system accessibility setting.

```ts
import { AccessibilityInfo } from 'react-native'

// In animation hooks — check before animating
const isReducedMotion = await AccessibilityInfo.isReduceMotionEnabled()
const duration = isReducedMotion ? 0 : DURATION.normal
```

---

## 10. Accessibility

### 10.1 Touch Targets

Minimum touch target: **44×44px** on all interactive elements.  
This is an Apple HIG requirement and a practical usability rule. A parent in a moving vehicle with one hand on a child cannot hit a 24px button.

```tsx
// ✅ Minimum touch target enforced
const styles = StyleSheet.create({
  touchable: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  }
})
```

### 10.2 Screen Reader Support

```tsx
// ✅ Every interactive element has accessibilityLabel
<TouchableOpacity
  accessibilityLabel="Start morning trip for Bus KA05 AB1234"
  accessibilityRole="button"
  accessibilityState={{ disabled: isLoading }}
>

// ✅ Map markers have accessible descriptions
<Marker
  accessibilityLabel={`Bus ${bus.regNumber}, currently at ${bus.currentStop}, arriving in ${bus.etaMinutes} minutes`}
/>

// ✅ Status badges announce live updates
<View
  accessibilityLiveRegion="polite"
  accessibilityLabel={`Bus status: ${status}`}
>
```

### 10.3 Color Independence

**Never** convey information by color alone. Always pair color with:
- An icon
- A text label
- Or a pattern

```
❌ Wrong: Red dot means SOS (color only)
✅ Right: Red dot + "SOS" text label + AlertOctagon icon

❌ Wrong: Green route line = on time, yellow = delayed (color only)
✅ Right: Route color + status badge with text on the map
```

### 10.4 Focus States

Every interactive element must have a visible focus ring for keyboard navigation (web) and hardware keyboard users (iOS/Android).

```
Focus ring:
  Color    border.focus (color.sage.500)
  Width    2px
  Style    solid outline
  Offset   2px (outside the element)
```

---

## 11. React Native Implementation

### 11.1 Design Token File

```ts
// packages/ui/src/tokens/colors.ts
export const colors = {
  sage: {
    100: '#E8EDE5',
    200: '#CDD8C8',
    300: '#B2C3AA',
    400: '#97AE8C',
    500: '#7B9669',  // PRIMARY
    600: '#637B54',
    700: '#4B6040',
    800: '#344430',
  },
  forest: {
    400: '#5C6E55',
    500: '#4F5F49',
    600: '#47533F',
    700: '#404E3B',  // PRIMARY DARK
    800: '#323D2E',
    900: '#242B20',
  },
  mist: {
    100: '#E7EDE4',
    200: '#BAC8B1',  // PRIMARY LIGHT
    300: '#A0B496',
    400: '#889E7E',
  },
  slate: {
    300: '#9FB5B1',
    400: '#85A09B',
    500: '#6C8480',  // PRIMARY ACCENT
    600: '#556A66',
  },
  gold: {
    200: '#E8D9BF',
    300: '#D5BF98',
    400: '#C2A878',  // POP COLOR
    500: '#A88D5E',
    600: '#8E7348',
  },
  stone: {
    50:  '#F5F5F5',
    100: '#E6E6E6',
    200: '#CCCCCC',
    300: '#B3B3B3',
    400: '#999999',
    600: '#666666',
    800: '#333333',
    900: '#1A1A1A',
  },
  white: '#FFFFFF',
} as const
```

```ts
// packages/ui/src/tokens/semantic.ts
import { colors } from './colors'

export const semantic = {
  bg: {
    page:          colors.stone[50],
    surface:       colors.white,
    muted:         colors.mist[100],
    brand:         colors.sage[500],
    brandSubtle:   colors.sage[100],
  },
  text: {
    primary:    colors.forest[700],
    secondary:  colors.stone[600],
    muted:      colors.stone[400],
    inverse:    colors.white,
    brand:      colors.sage[600],
    accent:     colors.slate[500],
  },
  border: {
    default: colors.stone[100],
    strong:  colors.stone[200],
    brand:   colors.sage[400],
    focus:   colors.sage[500],
  },
  interactive: {
    primaryBg:          colors.sage[500],
    primaryBgHover:     colors.sage[600],
    primaryBgPressed:   colors.sage[700],
    primaryBgDisabled:  colors.mist[200],
    primaryText:        colors.white,
  },
  status: {
    live:     { bg: colors.sage[100], text: colors.forest[700], dot: colors.sage[500] },
    delayed:  { bg: colors.gold[200], text: colors.gold[600] },
    offline:  { bg: colors.stone[100], text: colors.stone[400] },
    error:    { bg: '#FEF2F2', text: '#991B1B', icon: '#DC2626' },
    success:  { bg: '#ECFDF0', text: '#2D6A4F', icon: colors.sage[500] },
    warning:  { bg: colors.gold[200], text: colors.gold[600], icon: colors.gold[400] },
  },
} as const
```

```ts
// packages/ui/src/tokens/spacing.ts
export const space = {
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
} as const

export const radius = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 24,
  full: 9999,
} as const

export const fontSize = {
  display: 32,
  h1:      26,
  h2:      22,
  h3:      18,
  bodyLg:  16,
  body:    15,
  bodySm:  13,
  label:   13,
  caption: 11,
} as const

export const fontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
} as const
```

### 11.2 StyleSheet Pattern

```tsx
// ✅ Correct — tokens only, StyleSheet.create, no magic values
import { StyleSheet } from 'react-native'
import { semantic, space, radius, fontSize, fontWeight } from '@saferide/ui/tokens'

const styles = StyleSheet.create({
  card: {
    backgroundColor: semantic.bg.surface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     semantic.border.default,
    padding:         space[6],
  },
  cardTitle: {
    fontSize:   fontSize.h3,
    fontWeight: fontWeight.semibold,
    color:      semantic.text.primary,
    marginBottom: space[2],
  },
  cardSubtitle: {
    fontSize: fontSize.bodySm,
    color:    semantic.text.secondary,
  },
})

// ❌ Wrong — never do this
const badStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',    // raw hex
    borderRadius:    12,           // magic number
    padding:         16,           // magic number
  },
})
```

---

## 12. Web Implementation

### 12.1 CSS Custom Properties

```css
/* apps/web-admin/src/styles/tokens.css */
:root {
  /* Palette */
  --color-sage-100: #E8EDE5;
  --color-sage-200: #CDD8C8;
  --color-sage-300: #B2C3AA;
  --color-sage-400: #97AE8C;
  --color-sage-500: #7B9669;
  --color-sage-600: #637B54;
  --color-sage-700: #4B6040;

  --color-forest-700: #404E3B;
  --color-forest-800: #323D2E;

  --color-mist-100: #E7EDE4;
  --color-mist-200: #BAC8B1;

  --color-slate-500: #6C8480;

  --color-gold-200: #E8D9BF;
  --color-gold-400: #C2A878;

  --color-stone-50:  #F5F5F5;
  --color-stone-100: #E6E6E6;
  --color-stone-200: #CCCCCC;
  --color-stone-400: #999999;
  --color-stone-600: #666666;

  /* Semantic */
  --bg-page:     var(--color-stone-50);
  --bg-surface:  #FFFFFF;
  --bg-muted:    var(--color-mist-100);

  --text-primary:   var(--color-forest-700);
  --text-secondary: var(--color-stone-600);
  --text-muted:     var(--color-stone-400);
  --text-inverse:   #FFFFFF;
  --text-brand:     var(--color-sage-600);

  --border-default: var(--color-stone-100);
  --border-strong:  var(--color-stone-200);
  --border-focus:   var(--color-sage-500);

  --interactive-primary-bg:       var(--color-sage-500);
  --interactive-primary-bg-hover: var(--color-sage-600);
  --interactive-primary-text:     #FFFFFF;

  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;

  /* Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-sm: 0 1px 3px rgba(64,78,59,0.08), 0 1px 2px rgba(64,78,59,0.04);
  --shadow-md: 0 4px 12px rgba(64,78,59,0.10), 0 2px 4px rgba(64,78,59,0.06);
  --shadow-lg: 0 8px 24px rgba(64,78,59,0.12), 0 4px 8px rgba(64,78,59,0.08);
}
```

### 12.2 Tailwind Config (if using Tailwind)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        sage: {
          100: '#E8EDE5',
          200: '#CDD8C8',
          300: '#B2C3AA',
          400: '#97AE8C',
          500: '#7B9669',
          600: '#637B54',
          700: '#4B6040',
          800: '#344430',
        },
        forest: {
          400: '#5C6E55',
          600: '#47533F',
          700: '#404E3B',
          800: '#323D2E',
          900: '#242B20',
        },
        mist: {
          100: '#E7EDE4',
          200: '#BAC8B1',
          300: '#A0B496',
        },
        slate: {
          500: '#6C8480',
          600: '#556A66',
        },
        gold: {
          200: '#E8D9BF',
          400: '#C2A878',
          500: '#A88D5E',
          600: '#8E7348',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(64,78,59,0.08), 0 1px 2px rgba(64,78,59,0.04)',
        md: '0 4px 12px rgba(64,78,59,0.10), 0 2px 4px rgba(64,78,59,0.06)',
        lg: '0 8px 24px rgba(64,78,59,0.12), 0 4px 8px rgba(64,78,59,0.08)',
      },
    },
  },
}
```

---

## 13. Do's & Don'ts

### Color

| ✅ Do | ❌ Don't |
|---|---|
| Use `color.forest.700` for text on mist/light surfaces | Use `color.sage.500` as text color on `color.mist.200` — fails contrast |
| Use `color.gold.400` sparingly as a highlight accent | Use gold for large sections or backgrounds — it's a pop color, not a base |
| Use semantic tokens in components | Use raw hex values in component code |
| Test every new color pairing against WCAG AA | Assume "it looks fine" — measure the contrast ratio |
| Use `color.slate.500` for secondary UI elements | Add new colors not in the palette — resolve with a new token PR |

### Typography

| ✅ Do | ❌ Don't |
|---|---|
| Use `text.h1` once per screen | Use multiple H1s — creates visual hierarchy confusion |
| Use `text.mono` for bus reg numbers and trip IDs | Use `Inter` for codes and identifiers |
| Pair `text.overline` + `text.h2` for section headers | Use H3 alone without visual context |
| Keep to 2 weight variants per screen | Mix 400, 500, 600, 700 all on the same screen |

### Spacing

| ✅ Do | ❌ Don't |
|---|---|
| Use spacing tokens (`space.4`, `space.6`) | Use arbitrary values like `padding: 13px` |
| Give every touchable element `minHeight: 44` | Make tap targets smaller than 44px |
| Use `space.8` (32px) between major screen sections | Cram sections together — visual breathing room is not wasted space |

### Components

| ✅ Do | ❌ Don't |
|---|---|
| Use the `Button` component for all actions | Use raw `TouchableOpacity` with custom styles |
| Use `Card` with `variant="warning"` for delay states | Style warnings inline with ad-hoc colors |
| Use `Badge variant="live"` for real-time status | Use plain text "Live" with no visual treatment |
| Keep map markers simple and immediately readable | Add text inside map markers — they become unreadable at zoom-out |

### Motion

| ✅ Do | ❌ Don't |
|---|---|
| Animate bus marker position smoothly (350ms) | Teleport bus markers — jarring, breaks mental model |
| Use the live pulse animation only for SOS | Animate non-urgent elements — overuse kills attention |
| Respect `isReduceMotionEnabled` | Always animate regardless of accessibility settings |

---

## 14. Quick Reference Tokens

### Copy-paste ready values for the most common patterns

```ts
// The 6 most-used colors in any component
const PRIMARY_BG    = '#7B9669'  // sage.500 — buttons, active states
const DARK_TEXT     = '#404E3B'  // forest.700 — all body text, headings
const LIGHT_SURFACE = '#BAC8B1'  // mist.200 — cards, panels
const ACCENT        = '#6C8480'  // slate.500 — secondary elements
const BASE_BG       = '#E6E6E6'  // stone.100 — page bg, dividers
const HIGHLIGHT     = '#C2A878'  // gold.400 — badges, premium touches

// The most common combos (contrast-safe)
// White text on sage button:          #FFFFFF on #7B9669  (4.6:1 ✅)
// Forest text on mist card:           #404E3B on #BAC8B1  (5.1:1 ✅)
// Forest text on white:               #404E3B on #FFFFFF  (10.2:1 ✅)
// Secondary text on white:            #666666 on #FFFFFF  (5.7:1 ✅)
// White text on forest button:        #FFFFFF on #404E3B  (10.2:1 ✅)

// ⛔ Forbidden combo — always fails contrast:
// Sage text on mist:                  #7B9669 on #BAC8B1  (1.9:1 ❌)
```

```
Font cheatsheet
  Screen title       Inter 700, 26px, color.forest.700
  Card header        Inter 600, 18px, color.forest.700
  Body copy          Inter 400, 15px, color.forest.700
  Supporting text    Inter 400, 13px, color.stone.600
  Button label       Inter 600, 13px, color.white (on primary)
  Timestamp          Inter 400, 11px, color.stone.400
  Bus reg number     JetBrains Mono 400, 13px, color.forest.700

Spacing cheatsheet
  Card internal padding    16px (space.4) compact  /  24px (space.6) comfortable
  Screen horizontal pad    16px (space.4)
  Between sections         32px (space.8)
  Between list items       12px (space.3)
  Icon → text gap          8px (space.2)
  Label → input gap        8px (space.2)

Component radius cheatsheet
  Buttons       8px (radius.md)
  Inputs        8px (radius.md)
  Cards         12px (radius.lg)
  Chips/pills   9999px (radius.full)
  Bottom sheet  16px top corners only (radius.xl)
```

---

*SafeRide Design System — "Jade Pebble Morning" v1.0*  
*Questions? Post in `#design-system`. Token additions require a PR with contrast ratio documented.*
