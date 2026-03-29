# SafeRide — Design System
> Version 2.0 · March 2026  
> Jade Pebble Morning · Calm · Grounded · Premium  
> **Single source of truth for all visual and interaction decisions**

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Iconography](#5-iconography)
6. [Motion & Animation](#6-motion--animation)
7. [Component Library](#7-component-library)
8. [Screen Patterns](#8-screen-patterns)
9. [Video UI Patterns](#9-video-ui-patterns)
10. [Integration & Partner UI](#10-integration--partner-ui)
11. [Notification Design](#11-notification-design)
12. [Accessibility](#12-accessibility)
13. [Platform Specifics](#13-platform-specifics)
14. [Voice & Tone](#14-voice--tone)
15. [Do & Don't](#15-do--dont)
16. [Design Tokens (Code)](#16-design-tokens-code)

---

## 1. Brand Identity

### 1.1 What SafeRide Feels Like

**Jade Pebble Morning.** That is the palette's name and the brand's personality. Imagine a calm morning in a forested hill station — muted greens, soft earth, light through mist, a stone path worn smooth. No alarm bells. No flashing red. Safety communicated through stillness.

SafeRide is used by parents at 7:45 AM when they are half-awake, rushing, and anxious. The product's job is to make that anxiety disappear in two seconds. It does that through calm design, not reassuring copy. A parent who can see the bus moving on a map does not need text that says "Don't worry."

### 1.2 Personality Pillars

| Pillar | What it means | What it rules out |
|---|---|---|
| **Calm** | Never alarm, never urgency unless truly urgent | Red as a default alert colour |
| **Grounded** | Natural palette, no neons, no gradients | Fluorescent colours, harsh contrasts |
| **Premium** | Earned through restraint, not decoration | Excessive borders, drop shadows, busy layouts |
| **Trustworthy** | Consistent, precise, never playful with safety information | Whimsical illustrations for core tracking screens |
| **Human** | Warm but not casual. Professional but not cold | Corporate blue tones, sterile whites |

### 1.3 Brand Name Usage

- **SafeRide** — always one word, capital S and R
- Never: Safe Ride, Saferide, SAFERIDE, safe-ride
- Tagline: *"Every child arrives safely."* — sentence case, full stop always

---

## 2. Color System

### 2.1 Primary Palette — Jade Pebble Morning

```
┌─────────────────────────────────────────────────────────────┐
│                  SAFERIDE COLOR PALETTE                     │
│                                                             │
│  ██████  Sage      #7B9669   Primary brand, active states   │
│  ██████  Forest    #404E3B   Headers, body text, CTAs       │
│  ██████  Mist      #BAC8B1   Cards, secondary backgrounds   │
│  ██████  Slate     #6C8480   Metadata, icons, supporting    │
│  ██████  Stone     #E6E6E6   Base surfaces, dividers        │
│  ██████  Gold      #C2A878   Alerts, premium, warmth        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Color Definitions

#### Sage `#7B9669`
The primary brand colour. Used for primary buttons, active navigation indicators, progress bars, and map markers. The colour of the app. When someone thinks "SafeRide," this is the green they see.

- Use on: white or stone backgrounds only
- Text on Sage: white (#FFFFFF) only
- Do not use Sage text on Mist — insufficient contrast

#### Forest `#404E3B`
The depth colour. Used for all primary text, headings, dark CTAs, and the hero sections of the admin portal. Gives the palette seriousness without harshness.

- Use for: all body text, page titles, dark button backgrounds
- Text on Forest: white (#FFFFFF) or Mist (#BAC8B1)
- Minimum text size on Forest: 12px

#### Mist `#BAC8B1`
The secondary surface. Used for cards, input backgrounds, and layered UI elements. The workhorse of the palette — it prevents the UI from being either stark white or heavy green.

- Use for: card backgrounds, tag fills, hover states on Sage elements
- Text on Mist: Forest (#404E3B) only
- Never: Sage text on Mist (WCAG fail)

#### Slate `#6C8480`
The sophistication colour. Prevents the palette from being "too green." Used for secondary text, timestamp labels, metadata, and supporting iconography.

- Use for: dates, distances, supporting labels, disabled states
- Text on Slate: white for reversed elements

#### Stone `#E6E6E6`
The breathing room colour. Used as the page background in the admin portal, dividers, and input borders. Creates space without using white.

- Use for: page backgrounds, horizontal rules, input borders, skeleton loaders
- Text on Stone: Forest (#404E3B) only

#### Gold `#C2A878`
The warmth and premium colour. Used sparingly — alerts, premium feature badges, and moments where a touch of warmth is needed. Not a warning colour. A luxury accent.

- Use for: alerts (not errors), premium plan badges, SOS-resolved states, highlight moments
- Text on Gold: white or a dark warm brown (#5C3D1A)
- Never use for: error states, danger warnings, standard informational UI

### 2.3 Semantic Colour Mapping

SafeRide maps semantic meanings to brand colours. We do not use conventional red/green/yellow because they break the calm brand.

| Semantic role | Colour | Hex | Rationale |
|---|---|---|---|
| Success / Safe / Active | Sage | `#7B9669` | The primary positive signal |
| Warning / Alert | Gold | `#C2A878` | Warm, not alarming |
| Danger / Critical (SOS only) | Warm Brown | `#8B6E5A` | Serious without alarm-red |
| Info / Neutral | Slate | `#6C8480` | Informational, no emotional charge |
| Disabled | Stone | `#E6E6E6` + Forest `#9AAF97` | Visually receded |

**Why no red?** Red triggers alarm. A parent who sees a red notification every time the bus is 3 minutes late becomes desensitised or anxious. Gold communicates "attention" without the physiological spike. Reserve the closest thing to urgency (warm brown) for SOS events only — and even then, let the haptics and sound do the alarming, not the colour.

### 2.4 Tinted Backgrounds

For status chips, tags, badges, and info boxes:

```
Sage tint 10%:    color-mix(in srgb, #7B9669 10%, white)   → tag backgrounds
Forest tint 8%:   color-mix(in srgb, #404E3B 8%, white)    → hover states
Gold tint 15%:    color-mix(in srgb, #C2A878 15%, white)   → alert backgrounds
Slate tint 12%:   color-mix(in srgb, #6C8480 12%, white)   → info boxes
```

### 2.5 Contrast Compliance

| Text colour | Background | Ratio | WCAG |
|---|---|---|---|
| Forest `#404E3B` | White `#FFFFFF` | 10.3:1 | ✅ AAA |
| Forest `#404E3B` | Stone `#E6E6E6` | 7.8:1 | ✅ AAA |
| Forest `#404E3B` | Mist `#BAC8B1` | 5.6:1 | ✅ AA |
| White `#FFFFFF` | Forest `#404E3B` | 10.3:1 | ✅ AAA |
| White `#FFFFFF` | Sage `#7B9669` | 3.8:1 | ✅ AA (large text / UI) |
| White `#FFFFFF` | Slate `#6C8480` | 3.1:1 | ⚠️ AA large only |
| Sage `#7B9669` | Mist `#BAC8B1` | 1.9:1 | ❌ Fail — never use |
| Sage `#7B9669` | Stone `#E6E6E6` | 2.9:1 | ❌ Fail — never use |

---

## 3. Typography

### 3.1 Type Scale

SafeRide uses two typefaces:

- **DM Serif Display** — emotional moments, headings, display copy, brand statements
- **DM Sans** — everything functional: labels, body copy, metadata, UI text

```
DM Serif Display: https://fonts.google.com/specimen/DM+Serif+Display
DM Sans:          https://fonts.google.com/specimen/DM+Sans
```

### 3.2 Type Ramp

| Name | Font | Size | Weight | Line Height | Use |
|---|---|---|---|---|---|
| Display | DM Serif Display | 38px | 400 | 1.1 | Marketing hero, onboarding headline |
| H1 | DM Serif Display | 28px | 400 | 1.2 | Page titles, modal headers |
| H2 | DM Serif Display | 22px | 400 | 1.25 | Section headings |
| H3 | DM Sans | 16px | 500 | 1.3 | Card titles, list group headers |
| Subheading | DM Sans | 12px | 500 | 1 | Labels, uppercase nav items |
| Body | DM Sans | 14px | 400 | 1.7 | All paragraph text |
| Body Small | DM Sans | 13px | 400 | 1.6 | Supporting text, descriptions |
| Caption | DM Sans | 11px | 400 | 1.5 | Timestamps, metadata, helper text |
| Code / Data | DM Mono | 12px | 400 | 1.5 | GPS coords, vehicle IDs, data values |

### 3.3 Weight Rules

Only two weights exist in SafeRide UI:

- **400 Regular** — body text, paragraph copy, supporting information
- **500 Medium** — labels, headings (DM Sans), subheadings, active states

**Never use 600, 700, or 800.** They appear heavy relative to the rest of the UI and break the calm aesthetic. If something feels too light at 400, the solution is size or colour, not weight.

### 3.4 Letter Spacing

| Context | Tracking |
|---|---|
| DM Serif Display (all sizes) | -0.02em |
| DM Sans H3 | 0 |
| Subheading (uppercase labels) | +0.12em |
| Code/data | 0 |
| Body and below | 0 |

### 3.5 Language Support

SafeRide ships in 7 languages. Typography rules for non-Latin scripts:

```
Hindi (Devanagari):   Noto Sans Devanagari, weight 400/500
Kannada:              Noto Sans Kannada
Tamil:                Noto Sans Tamil
Telugu:               Noto Sans Telugu
Marathi:              Noto Sans Devanagari (same as Hindi)
Malayalam:            Noto Sans Malayalam

Line height for all Indic scripts: 1.8 (they need more vertical space than Latin)
Font size: +1px relative to Latin equivalent (Indic scripts read smaller at same size)
```

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

SafeRide uses a base-4 spacing system. **Only values on this scale are permitted.**

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap, micro insets |
| `space-2` | 8px | Component internal padding (tight) |
| `space-3` | 12px | Component internal padding (default) |
| `space-4` | 16px | Card padding, section insets |
| `space-5` | 20px | Between related elements |
| `space-6` | 24px | Between unrelated sections |
| `space-8` | 32px | Major section separations |
| `space-10` | 40px | Page-level top/bottom padding |
| `space-12` | 48px | Large section gaps |
| `space-16` | 64px | Screen-level spacing |
| `space-20` | 80px | Marketing/onboarding layouts |

Never use: 5px, 7px, 9px, 13px, 15px, 17px, 22px — arbitrary values break visual rhythm.

### 4.2 Border Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Input borders, small chips |
| `radius-md` | 8px | Buttons, small cards |
| `radius-lg` | 12px | Cards, panels, modals |
| `radius-xl` | 16px | Bottom sheets, large modals |
| `radius-full` | 9999px | Pills, avatar circles, toggle tracks |

### 4.3 Layout Grid

**Mobile (React Native):**
- Safe area insets respected on all screens
- Horizontal padding: 16px (space-4) on all screens
- Vertical section gap: 24px (space-6)
- Card internal padding: 16px (space-4)

**Tablet (Admin portal):**
- Content max-width: 1280px
- Side navigation: 240px fixed
- Main content padding: 32px (space-8)
- Column grid: 12 columns, 24px gutters

**Elevation (shadows — used very sparingly):**

SafeRide does not use drop shadows in most contexts. Shadow = depth = visual noise. The only exceptions:

```css
/* Bottom sheet / drawer */
box-shadow: 0 -4px 20px rgba(64, 78, 59, 0.08);

/* Modal overlay (the modal itself, not the backdrop) */
box-shadow: 0 8px 32px rgba(64, 78, 59, 0.12);

/* Active map card (lifted state) */
box-shadow: 0 4px 16px rgba(64, 78, 59, 0.10);
```

No other shadows. The flat surfaces and tight borders create hierarchy without elevation.

---

## 5. Iconography

### 5.1 Icon Style

**Phosphor Icons** — the recommended library. Style: `regular` weight for most UI, `bold` weight for emphasis states.

```
npm: phosphor-react-native (mobile)
     phosphor-react (web)
```

Why Phosphor over others: the icons have organic, slightly rounded geometry that pairs with DM Serif Display without feeling tech-corporate. The variety of weights matches SafeRide's two-weight type system.

### 5.2 Icon Sizes

| Context | Size | Weight |
|---|---|---|
| Navigation bar | 24px | Regular |
| List item leading icon | 20px | Regular |
| Button with icon | 16px | Regular |
| Status indicator | 14px | Bold |
| Metadata inline icon | 14px | Regular |
| Map marker indicator | 20px | Bold |
| Empty state illustration | 56px | Thin |

### 5.3 Icon Colour

Icons inherit the colour context of their container:

- On white/stone: Forest `#404E3B`
- On Sage: White `#FFFFFF`
- On Forest: White `#FFFFFF`
- Metadata/supporting: Slate `#6C8480`
- Active/selected state: Sage `#7B9669`
- Alert/caution: Gold `#C2A878`
- SOS/critical: Warm Brown `#8B6E5A`

### 5.4 Key Icons for SafeRide

| Feature | Icon name | Notes |
|---|---|---|
| Bus / Vehicle | `Bus` | Primary tracking icon |
| Location / GPS | `MapPin` | Stop markers |
| Live tracking | `NavigationArrow` | Moving bus indicator |
| ETA / Time | `Clock` | ETA displays |
| Video / Camera | `VideoCamera` | Live view entry |
| Video recording | `RecordFill` | Active recording indicator |
| SOS | `SirenFill` | Emergency — bold red-brown |
| Student | `Student` or `UserCircle` | Child references |
| Route | `Path` | Route overview |
| Speed alert | `Gauge` | Speed violation |
| Route deviation | `ArrowsLeftRight` | Off-route alert |
| School | `Buildings` | School geofence |
| Notification | `Bell` | Notification centre |
| Integration | `PlugsConnected` | Integration status |

---

## 6. Motion & Animation

### 6.1 Timing Tokens

| Token | Duration | Easing | Use |
|---|---|---|---|
| `duration-instant` | 100ms | linear | State colour changes |
| `duration-fast` | 200ms | ease-out | Button press, badge update |
| `duration-default` | 350ms | ease-in-out | Panel transitions, card reveals |
| `duration-slow` | 500ms | ease-in-out | Page transitions, map zoom |
| `duration-enter` | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | Elements entering the screen |
| `duration-exit` | 250ms | cubic-bezier(0.4, 0, 1, 1) | Elements leaving the screen |

### 6.2 Motion Principles

**Still water.** SafeRide's motion is gentle, purposeful, and never surprising. Think of a stone resting in a quiet stream — it moves only with intention.

- **No bounce.** Spring physics (overshoot) communicates playfulness. This brand is calm. Use ease curves only.
- **No spin.** Rotating loaders are acceptable only for content loading, never for decorative purposes.
- **No parallax.** Complex layer-based scrolling adds no safety-relevant information.
- **Purposeful only.** If an animation does not communicate state change or guide attention, remove it.

### 6.3 Map Marker Animation

The moving bus marker is the most important animation in the product.

```
Position update received (every 5 seconds):
  Animate marker from current position to new position
  Duration: 4500ms (just under the 5-second update interval)
  Easing: linear
  ← This creates the appearance of continuous movement
  ← Abrupt jumps every 5s would feel like a broken product

Heading update:
  Rotate marker icon to match bus heading
  Duration: 800ms ease-in-out

Bus arrives at stop:
  Brief pulse (scale 1.0 → 1.15 → 1.0)
  Duration: 600ms ease-in-out
  Once only (not looping)
```

### 6.4 Specific Animation Patterns

**ETA countdown changes:**
```
When ETA changes:
  Old number slides up and fades out (200ms)
  New number slides in from below (200ms)
  ← Never just swap in place — the motion confirms real-time data
```

**Push notification banner:**
```
Enter: slides down from top (350ms ease-out)
Exit: slides up and fades (250ms ease-in)
Auto-dismiss: after 4 seconds
```

**Bottom sheet (bus detail, video player):**
```
Enter: slides up from bottom (400ms cubic-bezier(0.4, 0, 0.2, 1))
Exit: slides down (250ms ease-in)
Backdrop: fade in (350ms) from rgba(0,0,0,0) to rgba(0,0,0,0.4)
```

**Video stream start:**
```
Loading: skeleton shimmer on video frame area
Stream connected: fade in video (500ms ease-in)
Never: hard cut from loading to video
```

---

## 7. Component Library

### 7.1 Buttons

**Primary Button** — Sage fill, white text, Forest on active

```
Background:      #7B9669 (Sage)
Text:            #FFFFFF, DM Sans 14px/500
Height:          44px
Padding:         0 20px
Border radius:   8px (radius-md)
Active state:    background → #404E3B (Forest)
Disabled state:  background → #E6E6E6, text → #9AAF97
Icon (optional): 16px, left of text, 8px gap
```

**Secondary Button** — Transparent fill, Forest border and text

```
Background:      transparent
Border:          1px solid #7B9669 (Sage)
Text:            #404E3B (Forest), DM Sans 14px/500
Height:          44px
Hover:           background → Sage at 8% opacity
Active:          background → Sage at 15% opacity
```

**Ghost Button** — Gold-tinted background, Forest text

```
Background:      color-mix(in srgb, #C2A878 15%, white)
Text:            #404E3B (Forest), DM Sans 14px/500
Height:          44px
Use for:         Secondary actions, "Contact school", warm CTAs
```

**Danger Button** — Reserved for SOS / irreversible actions only

```
Background:      #8B6E5A (Warm Brown)
Text:            #FFFFFF
Only appear:     SOS screens, delete confirmations
```

**Icon Button** — Square touch target, no text

```
Size:            44×44px touch target (icon itself: 20-24px)
Background:      transparent
Active:          Sage at 10% fill
Use for:         Navigation actions, map controls
```

### 7.2 Input Fields

```
Height:          44px
Background:      #FFFFFF (white) on Stone backgrounds
                 #F4F6F2 (off-white, slight sage tint) on White backgrounds
Border:          1px solid #E6E6E6 (Stone)
Border (focus):  1px solid #7B9669 (Sage)
Border radius:   8px
Text:            Forest #404E3B, DM Sans 14px
Placeholder:     Slate #6C8480
Label:           DM Sans 11px/500, Slate, uppercase, 0.12em tracking
Error state:     Border → Warm Brown #8B6E5A, helper text below in Warm Brown
```

### 7.3 Cards

**Standard Card**

```
Background:      #FFFFFF
Border:          0.5px solid rgba(64, 78, 59, 0.12) (very subtle Forest)
Border radius:   12px (radius-lg)
Padding:         16px
Shadow:          none (default)
                 Shadow only on lifted/modal state
```

**Mist Card** — for nested or secondary content

```
Background:      #BAC8B1 (Mist)
Border:          none
Border radius:   10px
Padding:         14px
Text:            Forest #404E3B
```

**Forest Card** — for hero sections, empty states, onboarding

```
Background:      #404E3B (Forest)
Border radius:   16px
Text:            White or Mist
```

### 7.4 Badges & Tags

**Active / Success**
```
Background: Sage 18% → color-mix(in srgb, #7B9669 18%, white)
Text:       #404E3B (Forest)
Font:       DM Sans 11px/500, uppercase, +0.04em tracking
Padding:    3px 10px, border-radius: 999px
```

**Alert / Warning**
```
Background: Gold 20% → color-mix(in srgb, #C2A878 20%, white)
Text:       #7A5C1E (dark gold)
Same dimensions as Active badge
```

**Neutral / Metadata**
```
Background: Slate 15% → color-mix(in srgb, #6C8480 15%, white)
Text:       #6C8480 (Slate)
```

**Premium Feature**
```
Background: Gold 25%
Text:       Forest, with a small star icon (⬡ Phosphor HexagonFill 10px)
Use for:    "Video", "RFID Tap", integration feature labels
```

### 7.5 Navigation (Mobile)

**Bottom Tab Bar**

```
Background:      #FFFFFF
Border-top:      0.5px solid #E6E6E6 (Stone)
Height:          56px + safe area inset
Active tab:      Icon → Sage, label → Forest/500
Inactive tab:    Icon → Slate, label → Slate/400
Active indicator: Sage pill above icon (24px wide, 3px tall, radius-full)
```

**Top Navigation Bar**

```
Background:      #FFFFFF
Height:          52px + safe area top
Title:           DM Serif Display 18px, Forest, centered
Back button:     Left-aligned, Phosphor ArrowLeft 20px, Slate
Divider:         0.5px Stone at bottom
```

### 7.6 Map Components

**Bus Marker (Active)**
```
Shape:       Circle 36px with Forest #404E3B fill
Icon:        Bus icon 18px, White
Direction:   Rotated to match heading
Pulse:       Subtle Sage ring that expands and fades (2s loop, low opacity)
             ← communicates "live" without being distracting
```

**Bus Marker (Offline / Stale)**
```
Same shape, fill → Stone #E6E6E6
Icon → Slate #6C8480
No pulse ring
Label below: "Last seen Xm ago" in Caption style
```

**Stop Marker**
```
Shape:       Circle 20px, Mist fill, Forest 1px border
Active stop: Fill → Sage, white dot centre
Visited stop: Fill → Stone, checkmark icon
```

**Route Polyline**
```
Upcoming route:  Sage #7B9669, 3px, semi-transparent (0.6)
Completed route: Stone #E6E6E6, 2px
Deviation alert: Gold #C2A878, 3px, dashed
```

**ETA Card (floating map overlay)**
```
Background:      Forest #404E3B
Text:            White, DM Serif Display for the number
Format:          Large number + "min", small "at [stop name]"
Corner radius:   12px
Padding:         12px 16px
Position:        Bottom of map, above tab bar
```

### 7.7 List Items

**Standard list item (bus list, route stops)**

```
Height:          64px (with subtitle) or 52px (label only)
Background:      #FFFFFF
Active/pressed:  Stone #E6E6E6 fill
Leading:         Icon or avatar (40px circle), 16px from left edge
Content:         Title (Body, Forest), Subtitle (Caption, Slate)
Trailing:        Chevron (Slate), status badge, or action icon
Divider:         0.5px Stone, inset 16px from left (not full-width)
```

---

## 8. Screen Patterns

### 8.1 Home Screen — Parent Live Tracking

```
┌────────────────────────────────┐
│  Status bar                    │  ← System, transparent
├────────────────────────────────┤
│  SafeRide         [Bell] [Pic] │  ← Nav bar, Forest bg
├────────────────────────────────┤
│                                │
│         LIVE MAP               │  ← Full-width, max height
│    (bus marker animated)       │
│                                │
├────────────────────────────────┤
│  ┌────────────────────────┐    │  ← Floating ETA card
│  │  Bus 7 · 4 minutes     │    │  Forest bg, white text
│  │  Indiranagar 5th Cross │    │
│  └────────────────────────┘    │
├────────────────────────────────┤
│  ┌────────────────────────┐    │  ← Bottom drawer card
│  │  🔴 LIVE   [Watch]     │    │  White card, slides up
│  │  Raju Kumar · KA05..   │    │
│  │  Stop 4 of 12          │    │
│  │  [Progress bar]        │    │
│  └────────────────────────┘    │
├────────────────────────────────┤
│  Home  Route  Video  Alerts  👤│  ← Tab bar
└────────────────────────────────┘

Map takes maximum available space.
ETA card is always visible.
Driver detail card slides up — doesn't replace map.
```

### 8.2 Driver App — Active Trip

```
┌────────────────────────────────┐
│  SafeRide is active            │  ← Persistent foreground notification
├────────────────────────────────┤
│                                │
│     Route A · Stop 4 of 12    │  ← Progress (DM Sans 14/500)
│     ════════●════════          │  ← Sage progress bar
│                                │
│  Next: Koramangala 6th Block   │  ← DM Serif Display 22px
│  3 students boarding here      │  ← Caption, Slate
│                                │
├────────────────────────────────┤
│  ┌──────────┐  ┌────────────┐  │
│  │  43 km/h │  │ 0 alerts   │  │  ← Speed + alerts chips
│  └──────────┘  └────────────┘  │
│                                │
├────────────────────────────────┤
│                                │
│       ████████████████████     │
│       █                  █     │  ← SOS button
│       █   HOLD FOR SOS   █     │  
│       ████████████████████     │  Forest bg, Warm Brown on long-press
│                                │
├────────────────────────────────┤
│         [End Trip]             │  ← Secondary button, bottom
└────────────────────────────────┘

SOS is a hold (not tap) — prevents accidental activation.
Speed prominently visible — driver accountability.
Clean, minimal — driver should not be looking at this screen.
```

### 8.3 Fleet Dashboard — Transport Manager (Web)

```
┌────────┬───────────────────────────────────────────────────┐
│        │  Alerts   Buses   Routes   Drivers   Video         │
│  S     ├────────────────────────────────────────────────────┤
│  I     │                                                    │
│  D     │                    LIVE MAP                        │
│  E     │  (All buses with markers, colour by status)        │
│  B     │                                                    │
│  A     ├─────────────────────┬──────────────────────────────┤
│  R     │  ALERTS FEED        │  BUS LIST                    │
│        │  ─────────────────  │  ─────────────────────────── │
│ 240px  │  Speed: Bus 3       │  Bus 7  ●active  42km/h      │
│ Forest │  Route dev: Bus 11  │  Bus 3  ●active  61km/h  ⚠️  │
│ bg     │  SOS: (none)        │  Bus 11 ●deviated             │
│        │                     │  Bus 2  ○idle                 │
└────────┴─────────────────────┴──────────────────────────────┘

Sidebar: Forest background, white/Mist text
Map: full-height, right of sidebar
Panels: below map, white cards on Stone background
Status colours follow semantic palette (Sage active, Gold alert, Brown SOS)
```

---

## 9. Video UI Patterns

### 9.1 Live Video Entry Point

The live video button appears in the parent app only when:
- Trip is active
- Parent's tenant has video feature enabled
- Network quality is 4G or better

```
Entry point on Home screen:
  A "LIVE" badge (red pill — only legitimate red in the UI)
  alongside a "Watch" secondary button

  "LIVE" badge: #CC4444 fill, white text "● LIVE" 11px/500
  ← This is the one exception to the no-red rule.
     Red for "live" is universally understood and expected.
     It does not signal danger, it signals broadcast.

  "Watch" button: Ghost button style, Sage-tinted
```

### 9.2 Live Video Player Screen

```
┌────────────────────────────────┐
│  [←]  Bus 7 — Live    [●LIVE] │  ← Nav bar, Forest bg
├────────────────────────────────┤
│                                │
│                                │
│     ████████████████████████   │  ← Video stream (16:9)
│     █    BUS INTERIOR    █   │     Stone bg while loading
│     ████████████████████████   │
│                                │
│  480p · 18 viewers             │  ← Quality + viewer count, Caption
├────────────────────────────────┤
│                                │
│  Bus 7 · Route A               │  ← Context
│  4 km/h · Stopped at Stop 6   │  ← GPS data synced with video
│                                │
├────────────────────────────────┤
│  ────────────────────────      │  ← Subtle divider
│  Poor connection?              │
│  Video requires 4G or WiFi.    │  ← Shown only if degraded
└────────────────────────────────┘

Video is always accompanied by live GPS context below.
No video controls visible during live (no pause, no seek — it is live).
Viewer count shown — creates social proof ("other parents are watching").
Quality indicator shown — transparency builds trust.
```

### 9.3 Recording Playback Screen (Admin)

```
┌────────────────────────────────────────────────────────────┐
│  [←]  Bus 7 · March 21, 2026 · Route A Morning            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ████████████████████████████████████████████████████     │
│  █              VIDEO PLAYBACK                      █     │
│  ████████████████████████████████████████████████████     │
│                                                            │
│  [◀◀]  [⏸]  ──────────●─────────────  07:43:22    [↗]  │
│                                                            │
├──────────────────────────┬─────────────────────────────────┤
│  GPS TIMELINE            │  EVENTS                         │
│  ──────────────────────  │  ──────────────────────────     │
│  07:00  Departed depot   │  07:42:18  Stop 4 arrived       │
│  07:15  Stop 1           │  07:58:34  Speed: 64 km/h ⚠️   │
│  07:28  Stop 3           │  08:12:00  School arrived       │
│  ● 07:43  Stop 4         │                                 │
│  07:58  Speed alert      │                                 │
│  08:12  School           │                                 │
└──────────────────────────┴─────────────────────────────────┘

Click GPS timeline → seeks video to that timestamp.
Click Events panel → seeks video to that event.
The correlation of video + GPS timeline is the core value here.
```

### 9.4 SOS Video Access (Dual-Auth Screen)

```
┌────────────────────────────────────────────────────────────┐
│  ⚠ Restricted Access — SOS Recording                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  This recording is protected. Access requires:            │
│                                                            │
│  ✓ School Principal authentication                         │
│  ○ SafeRide Operations authentication                      │
│                                                            │
│  [Request SafeRide Access]                                 │
│                                                            │
│  Incident: March 21, 2026 · 08:14 AM                      │
│  Duration: 60 seconds                                      │
│  All access is logged and may be used in legal proceedings │
│                                                            │
└────────────────────────────────────────────────────────────┘

Tone: serious, institutional, clear about legal weight.
No alarmist colours — Forest and Slate only.
The legal notice is non-dismissible.
```

---

## 10. Integration & Partner UI

### 10.1 Integrations Dashboard

```
Integrations page section header:
  "Connected Systems"
  Caption below: "Sync student data and receive events from your school systems"

Adapter cards:
  Status: "Connected" (Sage badge), "Setup required" (Gold badge), "Error" (Brown badge)
  Last sync: Caption + relative time ("Synced 3 hours ago")
  Quick action: "Sync now" ghost button, "Settings" text link

Layout: 2-column grid on desktop, 1-column on tablet
```

### 10.2 Webhook Registration UI

```
Form structure:
  1. Endpoint URL — input field, full width
  2. Events to subscribe — multi-select checkboxes, grouped by category
     Group: Trip events  (trip.started, trip.ended, trip.delayed)
     Group: Safety events (sos.triggered, speed_exceeded)
     Group: Student events (student.boarded — Phase 2)
  3. Secret — password input with "Generate" button
  4. Test endpoint — "Send test event" ghost button

After registration:
  Show delivery log inline (last 10 attempts, status code chips)
  Color: 2xx → Sage chip, 4xx → Gold chip, 5xx → Brown chip
  Retry count shown as small superscript badge
```

### 10.3 Partner API Key Display

```
API credentials screen:
  client_id: shown in full (DM Mono, copyable)
  client_secret: masked by default (••••••)
                 "Reveal" requires 2FA re-auth
  webhook_secret: same masking pattern

Security note design:
  Forest-tinted left border (4px, Forest colour)
  Light Forest bg (3% opacity)
  Caption: "Store these credentials securely. They will not be shown again."
  
Rotation section:
  "Rotate secret" — requires confirm dialog
  Confirm dialog explains 24-hour grace period clearly
```

---

## 11. Notification Design

### 11.1 Push Notification Anatomy

```
App icon + "SafeRide" title
[Bold title line]
[Body text — 60 chars max for SMS fallback parity]

Examples:

Title: Bus 7 is 10 minutes away
Body:  Heading to Indiranagar 5th Cross. Get ready.

Title: Bus 7 has arrived
Body:  At Indiranagar 5th Cross. Arjun's bus is here.

Title: Bus 7 — Delayed
Body:  Running 18 minutes late. New ETA: 08:03 AM.

Title: EMERGENCY — Bus 7
Body:  SOS triggered. Contact school transport immediately.
```

### 11.2 In-App Alert Banner

For non-critical alerts that appear while the user is in the app:

```
Position:       Top of screen, below navigation bar
Height:         52px + safe area top
Background:     Gold #C2A878 at 15% opacity on white (alert)
                Warm Brown at 15% (critical)
Icon:           Warning or Info phosphor icon, left-aligned
Text:           DM Sans 13px, Forest
Dismiss:        X button right-aligned
Auto-dismiss:   8 seconds for alerts, never for critical
Animation:      Slides down from nav bar (350ms ease-out)
```

### 11.3 Empty States

When no data is available (no trip active, no alerts, etc.):

```
Layout:
  Icon: Phosphor thin style, 56px, Mist colour
  Heading: DM Serif Display 22px, Forest
  Body: DM Sans 14px, Slate, max 2 lines
  CTA: Primary button if action available

Example — no active trip:
  Icon: Bus (thin, 56px, Mist)
  Heading: No trip in progress
  Body: Bus 7 is scheduled to depart at 6:55 AM
  CTA: (none — parent cannot start a trip)

Example — no integrations:
  Icon: PlugsConnected (thin, 56px, Mist)
  Heading: Connect your school system
  Body: Sync students from Fedena, Entab, or import via CSV
  CTA: [Set up integration] — primary button
```

---

## 12. Accessibility

### 12.1 Touch Target Minimums

- All interactive elements: minimum **44×44px** touch target
- Spacing between adjacent touch targets: minimum **8px**
- Small icons (14px) must be wrapped in at least 44px touch target container

### 12.2 Colour Contrast Requirements

All text must meet WCAG 2.1 AA minimum:
- Normal text (<18px): 4.5:1 ratio
- Large text (≥18px or ≥14px bold): 3:1 ratio
- UI components and graphical objects: 3:1 ratio

See [Section 2.5](#25-contrast-compliance) for approved pairings. When in doubt, use Forest on white — it always passes.

### 12.3 Screen Reader Support

**React Native:**
```tsx
// Every interactive element needs accessibilityLabel
<TouchableOpacity
  accessibilityLabel={`View live map for Bus ${busNumber}`}
  accessibilityRole="button"
  accessibilityHint="Opens live GPS tracking for this bus"
>
  ...
</TouchableOpacity>

// Map markers need accessible descriptions
<Marker
  accessibilityLabel={`Bus ${busNumber}, ${etaMinutes} minutes away`}
/>

// Video player
<VideoPlayer
  accessibilityLabel="Live bus interior camera feed"
  accessibilityHint="Shows real-time video from inside the school bus"
/>
```

### 12.4 Dynamic Type

All text in the parent app must respect system font size settings. Use `useWindowDimensions()` and Expo's accessibility API to scale gracefully.

Text that must not scale: map marker labels, badge text (they have fixed layout constraints). These must remain at fixed sizes and rely on contrast for legibility.

---

## 13. Platform Specifics

### 13.1 iOS Guidelines

- Use `SafeAreaView` on all screens — iPhone notch and dynamic island must be respected
- Navigation follows iOS conventions: back swipe gesture, large title on scroll
- Haptics: use `expo-haptics` for the following events:
  - SOS button long-press: `Haptics.impactAsync(Heavy)` on hold start
  - Trip started: `Haptics.notificationAsync(Success)`
  - Alert received (while in-app): `Haptics.impactAsync(Medium)`
  - End trip confirm: `Haptics.notificationAsync(Warning)`

### 13.2 Android Guidelines

- `android:windowSoftInputMode="adjustResize"` for all forms
- Foreground service notification for driver GPS must use a foreground notification with the SafeRide icon in Sage colour
- Back button: respect Android back stack. Home screen back button closes app (with confirmation).
- Material ripple effect on buttons and list items: use `TouchableNativeFeedback` with Sage ripple colour at 20% opacity

### 13.3 Web Admin Portal

- Minimum supported: Chrome 100+, Safari 15+, Firefox 100+, Edge 100+
- Minimum viewport: 1024px wide (not mobile-responsive in Phase 1)
- Keyboard navigation: all interactive elements must be reachable via Tab
- Map zoom: scroll wheel + trackpad pinch both supported

---

## 14. Voice & Tone

### 14.1 Writing Principles

**Calm, never cold.** We are speaking to parents about their child's safety. The tone is warm, not transactional.

**Precise, never terse.** Every word earns its place. Short sentences. No filler. But not so clipped that it feels robotic.

**Grounded, never showy.** Premium through restraint. No exclamation marks. No "Amazing!" Let the product speak.

**Human, never casual.** Warm and personal but always professional. This is a child's safety — we carry that weight.

### 14.2 Copy Patterns

**ETA display:**
```
✅  "4 minutes away"
✅  "Arriving now"
✅  "Bus has arrived at your stop"
❌  "4 mins!"
❌  "🚌 Almost there!"
❌  "Your bus will be there soon"
```

**Alert notifications:**
```
✅  "Bus 7 is running 18 minutes late. New ETA: 8:03 AM."
❌  "DELAY ALERT: Bus 7 is late!"
❌  "Uh oh! Your bus is behind schedule 😬"
```

**Empty states:**
```
✅  "No trip in progress. Bus 7 is scheduled to depart at 6:55 AM."
❌  "Nothing to see here yet!"
❌  "Looks like the bus hasn't started its journey."
```

**Error messages:**
```
✅  "Unable to load bus location. Last updated 3 minutes ago."
❌  "Oops! Something went wrong."
❌  "Error 403: Access denied"
```

**Integration status:**
```
✅  "Fedena sync completed. 447 students updated."
✅  "Webhook delivery failed. Retrying in 5 minutes."
❌  "Sync done! 👍"
❌  "Critical error: webhook endpoint returned 500"
```

### 14.3 Tone by Context

| Context | Tone | Example |
|---|---|---|
| Onboarding | Warm, welcoming | "Set up once, track every morning." |
| Active tracking | Matter-of-fact | "Bus 7 · 4 minutes · Route A" |
| Delay alert | Calm, informative | "Running 18 minutes late." |
| SOS | Serious, clear | "Emergency alert from Bus 7. Contact school immediately." |
| Empty state | Reassuring | "No trips are running right now." |
| Error | Direct, actionable | "Video unavailable on this connection. Switch to WiFi." |
| Success | Quiet confirmation | "Trip started. Parents have been notified." |
| Integration | Technical, brief | "Synced 447 students from Fedena." |

---

## 15. Do & Don't

### 15.1 Visual Do's

- ✅ Use Sage as the primary active/selected state colour throughout
- ✅ Let whitespace breathe — do not fill every pixel
- ✅ Use DM Serif Display for emotional moments (ETA countdown, onboarding)
- ✅ Use Forest for all text on light backgrounds (not black)
- ✅ Keep the map as large as possible — it is the product
- ✅ Use Gold sparingly and intentionally — it must feel special
- ✅ Make SOS visually distinct from all other UI elements

### 15.2 Visual Don'ts

- ❌ Never use red as a standard UI colour (only the "LIVE" badge exception)
- ❌ Never use gradients or glassmorphism
- ❌ Never use drop shadows except for modals and bottom sheets
- ❌ Never use Sage text on Mist background (contrast fail)
- ❌ Never use font weight 600 or 700 — 500 is the maximum
- ❌ Never use ALL CAPS for body copy (subheadings only)
- ❌ Never use more than 3 brand colours in a single component
- ❌ Never bounce (spring physics) on any animation
- ❌ Never show a blank screen — always show last-known state with a timestamp
- ❌ Never use generic alert icons (exclamation triangle) — use context-specific Phosphor icons

### 15.3 Content Do's

- ✅ Always include a timestamp on any "last seen" or stale data display
- ✅ Include bus number in every notification (parents may have multiple children)
- ✅ Show the stop name, not just "your stop"
- ✅ Confirm actions with quiet visual feedback (not modal dialogs)
- ✅ Be direct about errors: what happened, what the user should do

### 15.4 Content Don'ts

- ❌ Never use exclamation marks in notifications or alerts
- ❌ Never use emoji in core tracking or safety UI
- ❌ Never say "Something went wrong" — explain what specifically
- ❌ Never truncate the bus number or stop name — they are critical identifiers
- ❌ Never mix languages in a single UI element

---

## 16. Design Tokens (Code)

### 16.1 React Native / Expo

```ts
// constants/colors.ts

export const COLORS = {
  // Core palette
  sage:      '#7B9669',
  forest:    '#404E3B',
  mist:      '#BAC8B1',
  slate:     '#6C8480',
  stone:     '#E6E6E6',
  gold:      '#C2A878',
  white:     '#FFFFFF',
  warmBrown: '#8B6E5A',

  // Semantic
  textPrimary:    '#404E3B',   // = forest
  textSecondary:  '#6C8480',   // = slate
  textMuted:      '#9AAF97',
  textInverse:    '#FFFFFF',

  bgPrimary:    '#FFFFFF',
  bgSecondary:  '#F4F6F2',    // Very slight sage tint
  bgCard:       '#FFFFFF',
  bgPage:       '#E6E6E6',    // = stone (admin portal)

  borderDefault: 'rgba(64, 78, 59, 0.12)',
  borderFocus:   '#7B9669',   // = sage

  // Status
  statusActive:    '#7B9669',  // = sage
  statusAlert:     '#C2A878',  // = gold
  statusCritical:  '#8B6E5A',  // = warm brown
  statusDisabled:  '#9AAF97',

  // Live video (only exceptions to no-red rule)
  liveBadge:   '#CC4444',
  liveText:    '#FFFFFF',
} as const

// constants/typography.ts
export const FONTS = {
  display: 'DMSerifDisplay-Regular',
  sans:    'DMSans-Regular',
  sansMed: 'DMSans-Medium',
  mono:    'DMSans-Regular',   // Fallback if DM Mono not loaded
} as const

export const FONT_SIZES = {
  display:    38,
  h1:         28,
  h2:         22,
  h3:         16,
  subheading: 12,
  body:       14,
  bodySmall:  13,
  caption:    11,
  code:       12,
} as const

export const LINE_HEIGHTS = {
  display:    38 * 1.1,
  h1:         28 * 1.2,
  body:       14 * 1.7,
  caption:    11 * 1.5,
  indic:      1.8,    // Multiply by font size for Indic scripts
} as const

// constants/spacing.ts
export const SPACING = {
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
} as const

export const RADIUS = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
} as const

// constants/animation.ts
export const DURATION = {
  instant: 100,
  fast:    200,
  default: 350,
  slow:    500,
  enter:   400,
  exit:    250,
  // Bus marker special:
  busMove: 4500,   // Just under GPS update interval
} as const
```

### 16.2 CSS / Web Admin

```css
/* styles/tokens.css */

:root {
  /* Palette */
  --color-sage:       #7B9669;
  --color-forest:     #404E3B;
  --color-mist:       #BAC8B1;
  --color-slate:      #6C8480;
  --color-stone:      #E6E6E6;
  --color-gold:       #C2A878;
  --color-warm-brown: #8B6E5A;

  /* Semantic text */
  --text-primary:   #404E3B;
  --text-secondary: #6C8480;
  --text-muted:     #9AAF97;
  --text-inverse:   #FFFFFF;

  /* Semantic backgrounds */
  --bg-primary:   #FFFFFF;
  --bg-secondary: #F4F6F2;
  --bg-page:      #E6E6E6;
  --bg-sidebar:   #404E3B;

  /* Borders */
  --border-default: rgba(64, 78, 59, 0.12);
  --border-subtle:  rgba(64, 78, 59, 0.06);
  --border-focus:   #7B9669;

  /* Typography */
  --font-serif: 'DM Serif Display', Georgia, serif;
  --font-sans:  'DM Sans', system-ui, sans-serif;
  --font-mono:  'DM Mono', 'Courier New', monospace;

  /* Spacing scale */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* Shadows (used sparingly) */
  --shadow-sheet: 0 -4px 20px rgba(64, 78, 59, 0.08);
  --shadow-modal: 0 8px 32px rgba(64, 78, 59, 0.12);
  --shadow-card:  0 4px 16px rgba(64, 78, 59, 0.10);

  /* Transitions */
  --transition-fast:    200ms ease-out;
  --transition-default: 350ms ease-in-out;
  --transition-enter:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-exit:    250ms cubic-bezier(0.4, 0, 1, 1);
}
```

### 16.3 Tailwind Config (Admin Portal)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        sage:      '#7B9669',
        forest:    '#404E3B',
        mist:      '#BAC8B1',
        slate:     '#6C8480',
        stone:     '#E6E6E6',
        gold:      '#C2A878',
        'warm-brown': '#8B6E5A',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:  ['"DM Mono"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    }
  }
}
```

---

*SafeRide Design System v2.0 — March 2026*  
*Maintained by: Design team · Questions: design@saferide.in*  
*Single source of truth — any design decision not documented here requires a PR to this file*
