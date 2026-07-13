# MyWebDrive Frontend Nothing UI Redesign Plan

> **Version:** 1.0
> **Scope:** `frontend/cruip-landing` (primary Next.js landing / admin frontend)
> **Reference:** [wangbh030722/vibe-nothing-ui-design](https://github.com/wangbh030722/vibe-nothing-ui-design)
> **Design skill:** `frontend-design-ui-ux`

This document is a design handoff for re-skinning the MyWebDrive frontend with the Nothing-inspired UI design system. It covers design principles, tokens, component specifications, page-level redesigns, and an implementation roadmap.

---

## Table of Contents

1. [Executive Summary & Design Context](#1-executive-summary--design-context)
2. [Design Tokens & Theming](#2-design-tokens--theming)
3. [Global Component Specifications](#3-global-component-specifications)
4. [Page Redesign — Marketing & Landing](#4-page-redesign--marketing--landing)
5. [Page Redesign — Admin Dashboard](#5-page-redesign--admin-dashboard)
6. [Page Redesign — Auth, Download Catalog & Docs](#6-page-redesign--auth-download-catalog--docs)
7. [Implementation Roadmap & Acceptance Criteria](#7-implementation-roadmap--acceptance-criteria)

---

## 1. Executive Summary & Design Context

### 1.1 Why apply Nothing UI to MyWebDrive

MyWebDrive is a developer-oriented cloud file storage and sharing platform. Its current frontend (`frontend/cruip-landing`) is built from Cruip's **"Simple Light"** Tailwind template, giving it a conventional SaaS landing look: blue primary buttons, magenta accents, rounded cards with shadows, and a warm Chinese typeface stack. While functional, the visual identity does not match the product's positioning as a precise, industrial, engineering-first tool.

The Nothing-inspired system from `vibe-nothing-ui-design` provides:

- **Monochrome discipline:** black/grey/white carry hierarchy; red is reserved for real signals.
- **Engineering credibility:** dot-matrix numerals, Geist Mono data labels, and frosted-glass cards feel like a device console rather than a marketing template.
- **Scarcity of attention:** the accent `#D71921` appears only when something genuinely needs the user's eye — over limit, live, error, badge.
- **Unified light/dark behavior:** one token set swaps cleanly between themes, while product consoles (dashboards) stay dark by rule.

### 1.2 Project scope

| Boundary | In scope | Out of scope |
|---|---|---|
| **Codebase** | `frontend/cruip-landing` only | `frontend/` (Vite root), backend microservices in `services/` |
| **Router** | App Router pages and shared layout/components | Nextra `/docs` content (MDX pages) is styled through the shared theme only |
| **Theme** | Light/dark toggle for marketing and auth pages | Backend admin tools outside this repo |
| **Tokens** | New Nothing token layer mapped into Tailwind v4 CSS variables | Replacing Tailwind with another framework |
| **Fonts** | Self-hosted Doto, Geist, Geist Mono, Newsreader Italic | Proprietary Nothing fonts (NDot/NType) |

### 1.3 Target users

- **Primary:** Chinese-speaking developers, technical teams, and modding communities who use MyWebDrive to distribute large files, assets, and tooling.
- **Secondary:** Admin/operators managing users, invitations, quotas, and publications through `/admin/*`.
- **Context:** Users expect reliability and density of information; the interface should feel like a utility, not a consumer app.

### 1.4 High-level principles adapted from the reference system

| # | Principle | How it manifests in MyWebDrive |
|---|---|---|
| 1 | **Monochrome first** | All UI hierarchy comes from `--bg`, `--surface`, `--raised`, `--line`, `--secondary`, `--primary`, `--display`. |
| 2 | **Accent is a signal only** | `#D71921` is allowed only for: over-quota badges, live/recording dots, error states, notification badges, and "needs decision" counts. |
| 3 | **Active controls invert** | Selected tabs, switches ON, primary buttons, current stepper steps use `--display`↔`--bg` inversion, never red. |
| 4 | **No shadows, no gradients** | Depth comes from 1px hairlines (`--line`, `--line-2`), whitespace, and frosted-glass cards. |
| 5 | **Glass cards** | Cards use `--glass` + `backdrop-filter: blur(12–16px)`, 8px radius, no border, hover `translateY(-2px)`. |
| 6 | **Typography roles** | Standalone numbers + `%` use **Doto**; UI/body uses **Geist**; labels/data use **Geist Mono** uppercase; editorial italic only for page-level marketing lines. |
| 7 | **Dot-field background** | Sparse ~1.3px dots at ~120px spacing, `mix-blend-mode: difference`, `z-index: -1`, always behind cards. |
| 8 | **Dashboards stay dark** | `/admin/*` renders in dark mode regardless of the global theme toggle. |
| 9 | **Tokens only** | No raw hex, no arbitrary px radii, no ad-hoc font stacks. |

### 1.5 Pages and components in scope

#### Marketing & public pages

| Route | Page file | Key components to redesign |
|---|---|---|
| `/` (currently redirects to `/admin/overview`) | `app/page.tsx` | Redirect behavior unchanged; visual system applies to any future landing content. |
| `/download` | `app/(default)/download/page.tsx` | `download/catalog-page.tsx`, filter chips, search field, asset cards. |
| `/article` | `app/(default)/article/page.tsx` | Article cards, header, typography. |
| `/tutorials` | `app/(default)/tutorials/page.tsx` | Tutorial list cards, thumbnails. |
| `/signin`, `/signup`, `/reset-password` | `app/(auth)/*` | Form inputs, buttons, dividers, error states. |

#### Admin dashboard (always dark)

| Route | Layout / page | Key components to redesign |
|---|---|---|
| `/admin/overview` | `app/admin/layout.tsx`, `app/admin/overview/page.tsx` | Stat cards, charts, metric tiles, segmented bars, tables. |
| `/admin/users` | `app/admin/users/page.tsx` | Data table, search, role chips, quota indicators. |
| `/admin/notifications` | `app/admin/notifications/page.tsx` | List items, badges, status pills. |
| `/admin/invitations` | `app/admin/invitations/page.tsx` | Code list, copy buttons, usage bars. |
| `/admin/publish` | `app/admin/publish/page.tsx` | Form controls, progress/stepper, confirmation modals. |

#### Shared components to re-tokenize

- `components/ui/header.tsx`
- `components/ui/footer.tsx`
- `components/ui/logo.tsx`
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/tabs.tsx`
- `components/ui/table.tsx`
- `components/ui/dialog.tsx`
- `components/ui/checkbox.tsx`
- `components/ui/select.tsx`
- `components/ui/separator.tsx`
- `components/hero-home.tsx`
- `components/cta.tsx`
- `components/bento-demo.tsx`
- `components/globe-demo.tsx`
- `components/download/catalog-page.tsx`

### 1.6 Comparison: current Cruip design vs. Nothing UI

| Dimension | Current Cruip/Tailwind state | Nothing UI target |
|---|---|---|
| **Primary color** | Blue `#3388BB` (`brand-primary-500`) | Replaced by `--display` inversion; blue removed from functional UI. |
| **Accent color** | Magenta `#881144` (`brand-accent-500`) | Replaced by signal red `#D71921` used only for signals. |
| **Background** | `bg-gray-50` / `bg-gray-950`, plain | Dot-field layer + frosted-glass modules. |
| **Cards** | White/dark cards, rounded-2xl, often shadowed | Glass fill, 8px radius, borderless, no shadow, hover `translateY(-2px)`. |
| **Buttons** | Blue/magenta fills, gradients in `ShimmerButton` | Inversion fills (`--display` on `--bg`), outline, or text; no shimmer gradients. |
| **Typography** | ZCOOL XiaoWei headings, Noto Sans SC body, Ma Shan Zheng signature | Geist body, Geist Mono labels/data, Doto standalone numbers, Newsreader Italic for one-line marketing lines. |
| **Font loading** | Self-hosted `.woff2` in `public/fonts/` | Self-hosted Doto, Geist, Geist Mono, Newsreader Italic; same `public/fonts/` strategy. |
| **Active states** | Color change / ring accent | Black↔white inversion. |
| **Depth** | Shadows, gradients | Hairlines, whitespace, glass, z-index. |
| **Dashboards** | Follows global light/dark toggle | Always dark, independent of page theme. |

### 1.7 Implementation assumptions and risks

- **Tailwind v4 CSS-variables approach:** The project already uses Tailwind v4 with `@theme` blocks in `app/css/style.css`. The Nothing tokens will be added as a new token layer there, replacing the Cruip brand scales. See Section 2 for the token definition.
- **Chinese language support:** Geist does not cover CJK glyphs. CJK fallback will be `Noto Sans SC`/`PingFang SC`/system Chinese fonts, but the **type role** (sans/mono/display) stays the same.
- **Current redirect on `/`:** The root currently redirects to `/admin/overview`. Any future marketing landing must use the same Nothing language; this document covers the shared component layer that makes that possible.
- **Component inventory:** Several third-party or animation-heavy components (`ShimmerButton`, `AnimatedBeam`, `Marquee`, `SmoothCursor`, etc.) conflict with the Nothing rules (gradients, shadows, bounce motion). These must be replaced with Nothing-compliant equivalents or removed.

### 1.8 Success criteria for this redesign

- [ ] All functional UI uses only black/grey/white hierarchy; red elements are countable and signal-only.
- [ ] No `box-shadow`, no gradients, no raw hex values outside tokens.
- [ ] Cards are glass, 8px radius, borderless, with `translateY(-2px)` hover.
- [ ] Dot field renders correctly behind cards in both light and dark modes.
- [ ] Standalone numbers and `%` use Doto; labels use Geist Mono uppercase.
- [ ] Admin dashboard stays dark regardless of global theme.
- [ ] Active controls invert black↔white; accent is never used for primary/selected states.

---

## 2. Design Tokens & Theming

### 2.1 Overview

This section defines the complete token system for applying the Nothing-inspired design language to `frontend/cruip-landing`. Tokens are the single source of truth for colors, typography, spacing, radius, motion, elevation, and breakpoints.

**Current baseline to replace:**
- Brand colors: primary blue `#3388BB`, accent magenta `#881144`
- Chinese fonts: ZCOOL XiaoWei (headings), Noto Sans SC (body), Ma Shan Zheng (signature), Sarasa Gothic SC (mono, fallback)
- Tailwind v4 with `@theme` block and CSS variables in `frontend/cruip-landing/app/css/style.css`

**Target architecture:**
- Monochrome-first palette with a single signal-red accent (`#D71921`)
- Dark mode as default for product dashboards (`/admin/*`); light/dark toggle for marketing pages
- Nothing fonts (Doto, Geist, Geist Mono) layered alongside existing self-hosted Chinese fonts
- All values exposed as CSS variables and Tailwind v4 theme tokens
- No shadows, no gradients, no raw hex/px/radius/font names in components

### 2.2 Color tokens

#### Base scale (monochrome)

| Token | Dark Value | Light Value | Role |
|---|---|---|---|
| `--bg` | `#000000` | `#F2F2F2` | Page canvas |
| `--surface` | `#0E0E0E` | `#FFFFFF` | Panels, menus, modals, command palette |
| `--raised` | `#171717` | `#EDEDED` | Thumbs, kbd, avatar fill, active rows |
| `--line` | `#222222` | `#E5E7EB` | Hairline dividers inside lists/tables |
| `--line-2` | `#333333` | `#CFCFCF` | Visible control borders, outlines |
| `--muted` | `#5A5A5A` | `#9A9A9A` | Placeholders, faintest text, ticks |
| `--secondary` | `#8C8C8C` | `#585A5A` | Labels, secondary text, mono labels |
| `--primary` | `#EDEDED` | `#1C1C1C` | Body text, default icon color |
| `--display` | `#FFFFFF` | `#000000` | Headings, hero numerals, inversion fill |

#### Accent & semantic status

| Token | Dark Value | Light Value | Use |
|---|---|---|---|
| `--accent` | `#D71921` | `#D71921` | Signal fill only: needs-decision, over-limit, live, error badge |
| `--accent-text` | `#FF4438` | `#C2141C` | Accent as foreground (text/border/icon) |
| `--accent-ink` | `#FFFFFF` | `#FFFFFF` | Text on top of an accent-red fill |
| `--success` | `#7BE38A` | `#3D8B4A` | Data state: good / connected |
| `--warning` | `#F2C94C` | `#9C6B00` | Data state: caution / pending |
| `--error` | `#FF5247` | `#D23B30` | Data state: error / destructive text |
| `--focus` | `rgb(59 130 246 / .55)` | `rgb(59 130 246 / .55)` | Accessibility focus ring (the only allowed non-monochrome decoration) |

**Accent rules**
- `--accent` is for signals only: live/recording dots, notification badges, over-limit values, needs-decision states, error fills.
- Active controls (primary button, switch ON, selected chip/tab, current stepper, today in calendar) invert black↔white using `--display` on `--bg`; they never use the accent.
- `--accent` is fill; `--accent-text` is foreground.

#### Glass / card

| Token | Dark Value | Light Value | Use |
|---|---|---|---|
| `--glass` | `rgba(16,16,16,.9)` | `rgba(255,255,255,.96)` | Card fill |
| `--glass-brd` | `rgba(255,255,255,.09)` | `rgba(0,0,0,.08)` | Optional inner hairline on glass |

#### Legacy brand deprecation

| Legacy | Replacement |
|---|---|
| `brand-primary` `#3388BB` | Remove; use monochrome tokens. Functional links/controls use `--primary` / `--secondary`. |
| `brand-accent` `#881144` | Remove; the single signal accent is now `--accent` `#D71921`. |
| Blue focus/CTA | Replace with `--display` inversion or `--focus` ring. |

### 2.3 Typography tokens

#### Font roles

Nothing defines five font roles. For MyWebDrive, the first four are mapped into a hybrid stack that keeps the existing self-hosted Chinese faces for body/heading while introducing Doto for dot-matrix numerals and Geist Mono for data labels.

| Role | Nothing Font | MyWebDrive Stack | Use |
|---|---|---|---|
| Dot Display | **Doto** | `Doto, monospace` | Standalone numerals, hero stats, percentages, clocks, module numbers |
| UI / Body | **Geist** | `Geist, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` | Body copy, UI text, marketing paragraphs |
| Mono / Data | **Geist Mono** | `"Geist Mono", "Sarasa Gothic SC", ui-monospace, monospace` | Uppercase labels, data, code, timestamps, table cells |
| Headline | **Geist SemiBold** | `"Geist", "Noto Sans SC", sans-serif` weight 600 | Card titles, dialog titles, section headings |
| Editorial Accent | **Newsreader Italic** | `Newsreader, Georgia, serif` italic | Page-level marketing pull quote only; never inside components |

#### Chinese font preservation

- **Body/heading fallback for CJK:** keep `Noto Sans SC` self-hosted as the primary CJK body font. Geist handles Latin; Noto Sans SC handles Chinese glyphs.
- **Display/marketing heading fallback:** keep `ZCOOL XiaoWei` for expressive Chinese headings where the Nothing editorial feel is not required, but limit it to page-level marketing headings (`h1` / `.heading`). Functional card/dialog titles use Geist SemiBold.
- **Signature/handwrite:** keep `Ma Shan Zheng` for occasional brand signatures, scoped to `.font-handwrite`.
- **Code/mono fallback:** keep `Sarasa Gothic SC` as the CJK mono fallback once a `.woff2` is provided; until then use `ui-monospace`.

#### Font tokens

```css
:root {
  --font-display: 'Doto', monospace;
  --font-ui: 'Geist', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'Geist Mono', 'Sarasa Gothic SC', ui-monospace, monospace;
  --font-head: 'Geist', 'Noto Sans SC', sans-serif;
  --font-editorial: 'Newsreader', Georgia, serif;
  --font-heading-zh: 'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif;
  --font-handwrite-zh: 'Ma Shan Zheng', cursive;
}
```

#### Type scale

| Token | Size | Line Height | Letter Spacing | Use |
|---|---|---|---|---|
| `text-display` | `2.5rem` (40px) | `1` | `-0.02em` | Hero numerals, large Doto stats |
| `text-heading-xl` | `2rem` (32px) | `1.2` | `-0.02em` | Page-level H1 |
| `text-heading-lg` | `1.5rem` (24px) | `1.2` | `-0.015em` | Section H2 |
| `text-heading-md` | `1.25rem` (20px) | `1.25` | `-0.01em` | Card/dialog titles |
| `text-body` | `1rem` (16px) | `1.5` | `0` | Body copy |
| `text-small` | `0.875rem` (14px) | `1.5` | `0` | Secondary body |
| `text-caption` | `0.6875rem` (11px) | `1.45` | `0.08em` | Mono labels, uppercase data labels |
| `text-label` | `0.625rem` (10px) | `1.2` | `0.1em` | Uppercase micro labels |

**Typography rules**
- Standalone numbers and their `%` sign use `var(--font-display)`.
- Letter units (GB, K, MB, ms) stay small `var(--font-mono)`.
- Labels are uppercase Geist Mono, `letter-spacing: 0.08em–0.12em`, color `--secondary`.
- Doto weight must stay ≤ 500 and `font-variation-settings: 'ROND' 100` to keep dots round.
- Editorial italic (Newsreader) is allowed only in page-level marketing copy, never inside reusable components.

### 2.4 Spacing scale

Use a 4px base grid. MyWebDrive aligns to the Nothing set while keeping useful Tailwind steps.

| Token | Value | Use |
|---|---|---|
| `--space-1` | `4px` | Tight touch, icon gaps |
| `--space-2` | `8px` | Button padding-y, inline gaps |
| `--space-3` | `12px` | Grid gap, card inner compact |
| `--space-4` | `16px` | Card padding, section inner gap |
| `--space-5` | `20px` | Form group gap |
| `--space-6` | `24px` | Standard card padding |
| `--space-8` | `32px` | Section sub-block gap |
| `--space-10` | `40px` | Large section gaps |
| `--space-16` | `64px` | New context separation |
| `--space-20` | `80px` | Section vertical padding |
| `--space-24` | `96px` | Hero section padding |
| `--space-32` | `128px` | Major section breaks |

**Rule:** when you reach for a divider, prefer more whitespace from the scale above.

### 2.5 Radius tokens

Nothing uses only three radii; no large capsules or heavy rounding.

| Token | Value | Use |
|---|---|---|
| `--r-sm` | `6px` | Buttons, inputs, small controls |
| `--r-md` | `8px` | Cards, modals, panels, glass surfaces |
| `--r-pill` | `999px` | Chips, switches, pills, avatars |

### 2.6 Motion tokens

| Token | Value | Use |
|---|---|---|
| `--duration-control` | `200ms` | Hover, focus, pressed, toggle |
| `--duration-theme` | `350ms` | Theme transitions |
| `--duration-transition` | `400ms` | Larger state transitions |
| `--ease-default` | `ease-in-out` | All motion |
| `--hover-opacity` | `0.8` | Buttons, links, icon buttons |
| `--hover-lift` | `-2px` | Cards on hover (`translateY(-2px)`) |

**Motion rules**
- Only `ease-in-out`; no spring, bounce, or parallax.
- Cards lift `translateY(-2px)` on hover; controls drop opacity to `0.8`.
- Active/pressed controls drop to `0.6` opacity.
- Disabled controls sit at `0.3` opacity.

### 2.7 Elevation & z-index

Nothing expresses depth through stacking and frosted glass only; no shadows.

| Token | Value | Layer |
|---|---|---|
| `--z-base` | `0` | Default content |
| `--z-elevated` | `10` | Cards above base |
| `--z-sticky` | `30` | Sticky headers, floating nav |
| `--z-overlay` | `40` | Modal backdrop, command palette |
| `--z-modal` | `50` | Modals, dialogs |
| `--z-popover` | `60` | Popovers, tooltips, dropdowns |
| `--z-toast` | `70` | Inline toast stacks |
| `--z-skip-link` | `80` | Accessibility skip links |
| `--z-dev` | `90` | Dev overlay |

**Glass card recipe**
```css
.card {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border-radius: var(--r-md);
  border: none;              /* borderless */
  transition: transform var(--duration-control) var(--ease-default);
}
.card:hover {
  transform: translateY(var(--hover-lift));
}
```

### 2.8 Background dot field

The signature Nothing dot field is implemented as a single fixed pseudo-element behind cards.

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px);
  background-size: 120px 120px;
  background-attachment: fixed;
  mix-blend-mode: difference;
}
```

Rules:
- Dots are `~1.3px` at `~120px` spacing.
- Use `mix-blend-mode: difference` on a white-dot layer for local inversion in both themes.
- Keep at `z-index: -1`; cards always cover it.
- For always-dark regions (dashboard `/admin/*`), re-apply the same `::before` on a `position: relative; isolation: isolate;` wrapper.

### 2.9 Breakpoints

Keep the existing Tailwind breakpoints; no custom changes required.

| Token | Value | Use |
|---|---|---|
| `sm` | `640px` | Mobile landscape |
| `md` | `768px` | Tablet portrait |
| `lg` | `1024px` | Tablet landscape / small desktop |
| `xl` | `1280px` | Desktop |
| `2xl` | `1536px` | Large desktop |

Container max widths:
- Marketing pages: `max-w-6xl` (`72rem` / 1152px) or `max-w-7xl` (`80rem` / 1280px)
- Dashboard grid: `max-w-[1480px]` matching Nothing's poster grid

### 2.10 Tailwind v4 `@theme` block

Add to `frontend/cruip-landing/app/css/style.css` inside the existing `@theme` block (or replace the legacy brand colors).

```css
@theme {
  /* Fonts */
  --font-sans: "Geist", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "Geist Mono", "Sarasa Gothic SC", ui-monospace, monospace;
  --font-display: "Doto", monospace;
  --font-head: "Geist", "Noto Sans SC", sans-serif;
  --font-editorial: "Newsreader", Georgia, serif;
  --font-heading-zh: "ZCOOL XiaoWei", "Noto Sans SC", sans-serif;
  --font-handwrite-zh: "Ma Shan Zheng", cursive;

  /* Colors */
  --color-bg: #000000;
  --color-surface: #0E0E0E;
  --color-raised: #171717;
  --color-line: #222222;
  --color-line-2: #333333;
  --color-muted: #5A5A5A;
  --color-secondary: #8C8C8C;
  --color-primary: #EDEDED;
  --color-display: #FFFFFF;
  --color-accent: #D71921;
  --color-accent-text: #FF4438;
  --color-accent-ink: #FFFFFF;
  --color-success: #7BE38A;
  --color-warning: #F2C94C;
  --color-error: #FF5247;
  --color-focus: rgb(59 130 246 / .55);

  /* Glass */
  --color-glass: rgba(16, 16, 16, .9);
  --color-glass-brd: rgba(255, 255, 255, .09);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-pill: 999px;
}
```

### 2.11 Light theme override

Apply via `html.light` or `[data-theme="light"]`.

```css
.light,
[data-theme="light"] {
  --color-bg: #F2F2F2;
  --color-surface: #FFFFFF;
  --color-raised: #EDEDED;
  --color-line: #E5E7EB;
  --color-line-2: #CFCFCF;
  --color-muted: #9A9A9A;
  --color-secondary: #585A5A;
  --color-primary: #1C1C1C;
  --color-display: #000000;
  --color-accent: #D71921;
  --color-accent-text: #C2141C;
  --color-accent-ink: #FFFFFF;
  --color-success: #3D8B4A;
  --color-warning: #9C6B00;
  --color-error: #D23B30;
  --color-glass: rgba(255, 255, 255, .96);
  --color-glass-brd: rgba(0, 0, 0, .08);
}
```

### 2.12 Dashboard dark lock

The `/admin/*` dashboard always renders dark, regardless of the global theme. Wrap the dashboard root in a region that pins the dark token set.

```css
.appwrap {
  background: var(--color-bg);
  color: var(--color-primary);
  position: relative;
  isolation: isolate;
}
.appwrap::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px);
  background-size: 120px 120px;
  background-attachment: fixed;
  mix-blend-mode: difference;
}
```

### 2.13 Font loading snippet

Self-host the Nothing fonts alongside existing Chinese fonts in `frontend/cruip-landing/public/fonts/`. Add `@font-face` declarations before the `@theme` block.

```css
@font-face {
  font-family: 'Doto';
  src: url('/fonts/Doto-ROND-wght.ttf') format('truetype');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Geist Mono';
  src: url('/fonts/GeistMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Newsreader';
  src: url('/fonts/Newsreader-Italic.woff2') format('woff2');
  font-style: italic;
  font-display: swap;
}
```

The existing Noto Sans SC, ZCOOL XiaoWei, and Ma Shan Zheng `next/font/local` declarations in `app/layout.tsx` remain; expose them as CSS variables and map them through the token stack above.

### 2.14 Token usage rules

- Use semantic tokens in components: `bg-bg`, `text-primary`, `border-line`, `bg-glass`, `text-accent-text`.
- Never use raw hex values, arbitrary pixel radii, or ad-hoc font names in markup.
- Primary interactive controls invert `display` ↔ `bg`; never use `--accent` for buttons, tabs, switches, or selected chips.
- Reserve `--accent` for signals only: live indicators, over-limit values, error badges, needs-decision labels.
- Standalone numbers and `%` use `font-display` (Doto); letter units use `font-mono`.
- Functional UI stays sans-serif; editorial italic is restricted to page-level marketing copy.
- Dashboards (`/admin/*`) ignore the global light theme and always render with the dark token set.

---

## 3. Global Component Specifications

This section defines the Nothing-inspired treatment for every reusable UI primitive in `frontend/cruip-landing`. All visual values are tokenized; see **Section 2 · Tokens** for the exact color, type, radius, spacing, and motion variables. Hard rules from the source system apply here without exception:

- Monochrome carries hierarchy; `--color-accent` is reserved for genuine signals only.
- Active/selected controls invert `--color-display` ↔ `--color-bg`; they never use the accent.
- No shadows, no gradients; depth comes from hairlines, whitespace, and frosted glass.
- Functional UI stays sans-serif; Doto is used only for standalone numerals and their `%` sign.
- Dashboard surfaces (`/admin/*`) remain dark regardless of the marketing page theme.

### 3.1 Button

#### Purpose
Triggers the primary action in a form, dialog, card, or page. Buttons are the loudest interactive element, but still monochrome.

#### Variants
- `primary` — solid `--color-display` fill with `--color-bg` text (black↔white inversion). Used for the single main action.
- `secondary` / `outline` — 1px `--color-line-2` hairline border, transparent fill, `--color-primary` text.
- `ghost` / `text` — no border, no fill; `--color-primary` text, hover opacity only.
- `icon` — 38px × 38px circular button for icon-only actions; uses `primary` or `ghost` semantics.
- `square` (`btn-sq`) — 6px radius square icon/action button for dense toolbars.

#### Props
```typescript
interface ButtonProps {
  /** Visual variant. Default: 'primary' */
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'square';
  /** Size. Default: 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state: shows a 16px inline spinner, preserves layout width */
  loading?: boolean;
  /** Full width on mobile */
  fullWidth?: boolean;
  /** Leading icon slot */
  prefix?: React.ReactNode;
  /** Trailing icon slot */
  suffix?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}
```

#### States
| State | Visual | Behavior |
|-------|--------|----------|
| Default | 6px radius, no shadow, label in `--font-mono` uppercase (Latin) or `--font-ui` (CJK) | Idle |
| Hover | `opacity: 0.8` | 200ms `ease-in-out` |
| Active / pressed | `opacity: 0.6` | Immediate visual feedback |
| Focus | 2px `--color-focus` ring, offset 2px | Keyboard only |
| Disabled | `opacity: 0.3`, `pointer-events: none` | No hover/active feedback |
| Loading | Opacity 0.8, spinner replaces prefix icon, text remains visible | Prevents duplicate submission |

#### Responsive Behavior
| Breakpoint | Behavior |
|------------|----------|
| Mobile (`<640px`) | `fullWidth` buttons stack to 100% width; icon buttons keep 38px |
| Tablet / desktop | Inline width driven by content + padding |

#### Accessibility
- `role="button"` (implicit on `<button>`).
- `aria-disabled="true"` when disabled or loading.
- `aria-busy="true"` when loading.
- Keyboard: `Enter` / `Space` activate; focus follows tab order.
- Screen reader announces label + disabled/loading state.

#### Animations
| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Hover | opacity 1 → 0.8 | 200ms | `ease-in-out` |
| Press | opacity 0.8 → 0.6 | 0ms (instant) | — |
| Focus | ring fade-in | 150ms | `ease-in-out` |

#### Edge Cases
| Scenario | Handling |
|----------|----------|
| Long label | truncate with `text-overflow: ellipsis`; max-width 240px |
| No `children` | require `aria-label` (icon-only) |
| Destructive confirmation | pair with an inline `Alert` or `Modal`; never make the button red |

#### Implementation Target
- **Agent:** nextjs-senior-engineer
- **File location:** `frontend/cruip-landing/components/ui/button.tsx`
- **Notes:** Replace current `destructive` variant with the confirmation pattern above; remove all `shadow-*` utilities.

---

### 3.2 Input

#### Purpose
Single-line text or data entry. Used inside forms, filters, search bars, and modal bodies.

#### Variants
- `default` — 6px radius, 1px `--color-line-2` border, `--color-surface` fill.
- `underline` — bottom hairline only; used inside minimal marketing forms.
- `error` — same as default but border uses `--color-error`; error text below.

#### Props
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text, rendered above the field */
  label?: string;
  /** Helper / hint text */
  hint?: string;
  /** Error message */
  error?: string;
  /** Variant */
  variant?: 'default' | 'underline' | 'error';
  /** Renders a leading icon or prefix */
  prefix?: React.ReactNode;
  /** Renders a trailing icon or suffix */
  suffix?: React.ReactNode;
}
```

#### States
| State | Visual |
|-------|--------|
| Default | `--color-line-2` border, `--color-primary` text, `--color-secondary` placeholder |
| Hover | border shifts to `--color-primary` |
| Focus | border `--color-primary`, 2px `--color-focus` ring, no glow |
| Error | border `--color-error`, error text `--color-error` below |
| Disabled | `opacity: 0.3`, no focus ring |
| Read-only | no border change, text `--color-primary` |

#### Accessibility
- Label is a real `<label>` associated via `htmlFor`.
- `aria-invalid="true"` and `aria-describedby` pointing to the error text when in error state.
- `aria-disabled` when disabled.
- Keyboard: standard text input navigation.

#### Typography
- Label: `--font-mono`, uppercase, 11px, `--color-secondary`, letter-spacing 0.08–0.12em.
- Value: `--font-mono` for numeric/data inputs; `--font-ui` for general text.
- Placeholder: `--color-muted`.

---

### 3.3 Checkbox / Radio / Switch

#### Purpose
Binary and mutually-exclusive selection controls. Checkbox for multi-select; Radio for single-select; Switch for immediate state toggles.

#### Variants
- `checkbox` — 16px square, 4px radius, line-2 border.
- `radio` — 16px circle, line-2 border.
- `switch` — pill track (24px × 14px) with 12px circular knob.

#### States
| State | Checkbox | Radio | Switch |
|-------|----------|-------|--------|
| Unchecked | 1px `--color-line-2` border, transparent fill | 1px `--color-line-2` border, transparent fill | track `--color-line-2`, knob `--color-primary` |
| Checked / ON | `--color-display` fill, `--color-bg` checkmark | `--color-display` fill, `--color-bg` dot | track `--color-display`, knob `--color-bg` |
| Disabled | `opacity: 0.3` across all variants | `opacity: 0.3` | `opacity: 0.3` |

#### Accessibility
- Checkbox: `role="checkbox"`, `aria-checked`.
- Radio: `role="radio"`, grouped with `role="radiogroup"`, arrow-key navigation.
- Switch: `role="switch"`, `aria-checked`.
- Each control has an associated `<label>` or `aria-labelledby`.

---

### 3.4 Chip / Tag

#### Purpose
Compact, low-attention labels for categories, filters, statuses, and metadata. Chips are pill-shaped; Tags use a technical 6px radius.

#### Variants
- `chip` — pill outline, default off.
- `tag` — 6px radius rectangle, default off.
- `active` — inversion fill (`--color-display` bg / `--color-bg` text).
- `removable` — trailing `×` icon button.
- `signal` — reserved for live / needs-decision / over-limit states; uses `--color-accent` fill with `--color-accent-ink` text.

#### States
| State | Visual |
|-------|--------|
| Default | 1px `--color-line-2` border, `--color-primary` text, transparent fill |
| Hover (default) | `opacity: 0.8` |
| Active | `--color-display` fill, `--color-bg` text |
| Signal | `--color-accent` fill, `--color-accent-ink` text |
| Disabled | `opacity: 0.3` |

#### Accessibility
- `role="button"` when clickable; `aria-pressed` for toggle chips.
- Removable chip exposes `aria-label="Remove [label]"` on the close button.

---

### 3.5 Card

#### Purpose
Container for related content, metrics, forms, and dashboard widgets. The primary surface for information grouping.

#### Variants
- `default` / `glass` — frosted glass fill, 8px radius, borderless.
- `flat` — solid `--color-surface` fill; used when backdrop-blur is performance-sensitive.
- `dashboard` — rendered inside the always-dark admin context; uses dark tokens regardless of page theme.

#### Props
```typescript
interface CardProps {
  variant?: 'glass' | 'flat' | 'dashboard';
  /** Optional 1px inner hairline */
  bordered?: boolean;
  hover?: boolean;
  children?: React.ReactNode;
}
```

#### States
| State | Visual |
|-------|--------|
| Default | `background: var(--color-glass)`, `backdrop-filter: blur(12px)`, `--radius-md` (8px), padding 24px |
| Hover | `translateY(-2px)` only; no shadow/border change |
| Bordered | adds 1px `--color-glass-brd` inner hairline |
| Disabled | `opacity: 0.5`, no hover lift |

#### Composition
- **Header**: title + optional action.
- **Title**: `--font-head`, 600, 18px, `--color-display`.
- **Description**: `--font-mono`, 10px, `--color-secondary`, uppercase.
- **Content**: default 16px top margin after header.
- **Footer**: right-aligned actions, 16px top margin.

#### Responsive Behavior
| Breakpoint | Behavior |
|------------|----------|
| Mobile | full-width, 16px padding, no side margins |
| Tablet+ | grid-driven widths, 24px padding |

---

### 3.6 Modal / Dialog

#### Purpose
Focused overlay for confirmations, forms, and multi-step tasks. Captures attention without leaving the page.

#### Variants
- `default` — centered, max-width 512px.
- `sheet` / `side` — slides from the right on desktop, full-screen on mobile (optional; default modal preferred).

#### Props
```typescript
interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Modal width */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Show close button in top-right */
  showCloseButton?: boolean;
  children?: React.ReactNode;
}
```

#### States
| State | Visual |
|-------|--------|
| Backdrop | `--color-bg` at 80% opacity, no blur shadow |
| Content | `--color-surface`, `--radius-md`, 24px padding, no shadow |
| Header | title `--font-head` 20px, optional description `--color-secondary` |
| Footer | left-aligned cancel (ghost) + right-aligned confirm (primary) |

#### Animations
| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Open | fade-in + zoom-in 0.95 → 1 | 200ms | `ease-in-out` |
| Close | fade-out + zoom-out 1 → 0.95 | 150ms | `ease-in-out` |
| Backdrop | fade only | 200ms | `ease-in-out` |

#### Accessibility
- `role="dialog"`, `aria-modal="true"`.
- Focus traps inside the modal.
- `Escape` closes; `Tab` cycles focus.
- `aria-labelledby` points to the title; `aria-describedby` points to description.
- Close button has `aria-label="Close"`.

---

### 3.7 Alert / Status

#### Purpose
Inline feedback for success, warning, error, and neutral system states. Replaces floating toasts.

#### Variants
- `success` — left border `--color-success`, faint 9% tint fill, icon `--color-success`.
- `warning` — left border `--color-warning`, faint 9% tint fill, icon `--color-warning`.
- `error` — left border `--color-error`, faint 9% tint fill, icon `--color-error`.
- `info` / `neutral` — left border `--color-line-2`, no tint, icon `--color-secondary`.

#### Props
```typescript
interface AlertProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: React.ReactNode;
  /** Main message */
  children?: React.ReactNode;
  /** Optional inline action */
  action?: React.ReactNode;
  /** If true, render as a compact one-liner for dense dashboards */
  compact?: boolean;
}
```

#### States
| State | Visual |
|-------|--------|
| Default | 3px left border, 8px radius, 16px padding, `--color-surface` or tinted fill |
| Compact | 3px left border, 12px padding, single line, no title |

#### Accessibility
- `role="alert"` for errors; `role="status"` for success/info.
- Icon has `aria-hidden="true"`; meaning is conveyed by text + role.
- Color is not the sole communicator (icon + title + text).

---

### 3.8 Table

#### Purpose
Dense display of records, metrics, and admin data. Used on `/admin/users`, `/admin/invitations`, `/admin/publish`, etc.

#### Variants
- `default` — hairline rows, no zebra.
- `selectable` — first column contains checkboxes.
- `sortable` — header cells are interactive and show ↑/↓ indicators.

#### Props
```typescript
interface TableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyAction?: { label: string; onClick: () => void };
  selectable?: boolean;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
}
```

#### States
| State | Visual |
|-------|--------|
| Header row | `--font-mono`, uppercase, 11px, `--color-secondary`, bottom hairline |
| Data row | `--font-mono`, 13px, `--color-primary`, hairline bottom |
| Hover row | `background: var(--color-raised)` |
| Selected row | `background: var(--color-raised)` + 2px `--color-accent` indicator on left |
| Empty | render `EmptyState` inside the table body |
| Loading | 4 rows of `--line` 1px horizontal lines + centered `[LOADING…]` mono `--muted` |
| Error | Inline alert: 1px `--error` left border, `--error` icon, retry button |

#### Responsive Behavior
| Breakpoint | Behavior |
|------------|----------|
| Mobile | horizontal scroll wrapper; do not reflow columns into cards unless explicitly designed |
| Tablet+ | full grid layout |

#### Accessibility
- `<table>` semantics with proper `<thead>`, `<tbody>`, `<th scope="col">`.
- Sortable headers: `aria-sort="ascending|descending|none"`, `role="columnheader button"`.
- Selectable rows: `aria-selected`, checkbox has `aria-label="Select row"`.

---

### 3.9 Navigation

#### Purpose
Wayfinding across the marketing site and admin console. Includes fixed header, tab bars, and pagination.

#### Header
```typescript
interface HeaderProps {
  /** Array of { label, href, active } */
  links?: NavLink[];
  /** Right-side actions */
  actions?: React.ReactNode;
  /** Glass or transparent background */
  variant?: 'glass' | 'transparent';
}
```

| Element | Visual |
|---------|--------|
| Container | fixed top, z-index 50, pill-shaped glass bar on desktop; full-width on mobile |
| Logo | left-aligned, `--font-display` for wordmark numeral/glyph if present |
| Links | `--font-mono`, uppercase, 12px, `--color-secondary`; active = `--color-display` |
| Active link | 2px bottom underline in `--color-display` (no accent) |

#### Tabs
```typescript
interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** 'underline' or 'pills' */
  variant?: 'underline' | 'pills';
  children?: React.ReactNode;
}
```

| Variant | Inactive | Active |
|---------|----------|--------|
| `underline` | `--color-secondary` text, no underline | `--color-display` text, 2px `--color-display` underline |
| `pills` | transparent, `--color-secondary` text | `--color-display` fill, `--color-bg` text |

#### Pagination
| Element | Visual |
|---------|--------|
| Page numbers | `--font-display` (Doto), 14px |
| Current page | `--color-display` fill, `--color-bg` text, 6px radius |
| Prev / Next | ghost icon buttons; disabled at boundaries (`opacity: 0.3`) |

#### Responsive Behavior
| Breakpoint | Behavior |
|------------|----------|
| Mobile | header links collapse into a sheet/menu; tabs scroll horizontally if needed |
| Tablet+ | full horizontal layout |

#### Accessibility
- Header: `<nav aria-label="Main">`.
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`.
- Pagination: `aria-label="Pagination"`, each page button has `aria-label="Page N"`.

---

### 3.10 Empty State

#### Purpose
Placeholder when a list, table, search result, or dashboard section has no data.

#### Variants
- `default` — dashed-border container, dot-matrix glyph, title, description, CTA.
- `compact` — inline one-liner for small panels.

#### Props
```typescript
interface EmptyStateProps {
  /** 9×9 dot-matrix glyph name */
  glyph?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action */
  action?: React.ReactNode;
  compact?: boolean;
}
```

#### States
| State | Visual |
|-------|--------|
| Default | 1px dashed `--color-line-2` border, `--radius-md`, 32px padding, centered content |
| Glyph | 9×9 dot-matrix icon at `--gs: 48px`, `--color-secondary` |
| Title | `--font-head`, 18px, `--color-display` |
| Description | `--font-ui`, 14px, `--color-secondary` |
| Action | one `primary` button, max 1 action |

---

### 3.11 Metric

#### Purpose
Dashboard KPI display: large standalone numbers with labels and optional deltas.

#### Variants
- `default` — inside a card, label above, value below.
- `inline` — horizontal layout for compact toolbars.
- `delta` — includes an up/down indicator and previous-period comparison.

#### Props
```typescript
interface MetricProps {
  label: string;
  value: string | number;
  /** e.g. '%', 'GB', 'ms' */
  unit?: string;
  /** Positive or negative change */
  delta?: number;
  /** Compact format for dense grids */
  compact?: boolean;
}
```

#### States
| State | Visual |
|-------|--------|
| Default | label `--font-mono` uppercase 10px `--color-secondary`; value `--font-display` (Doto), 32–40px, `--color-display` |
| Loading | value shows `[LOADING…]` in `--font-mono` `--muted` |
| Error | value shows `—` and an inline `Alert error` |
| Over-limit | value rendered in `--color-error`; label may show a signal dot |

---

### 3.12 Global implementation notes

1. **Token-only values.** Every color, radius, spacing, type, and motion value in these specs maps to a token defined in **Section 2**. No raw hex, px radii, or ad-hoc font stacks remain in component markup.
2. **Dashboard override.** Any component rendered inside `/admin/*` must use the dark token set. Do not rely on the page light/dark class for admin surfaces.
3. **No shadows / no gradients.** Remove all `shadow-*`, `drop-shadow-*`, and gradient utilities from the current `button.tsx`, `card.tsx`, `dialog.tsx`, and `header.tsx`.
4. **Font loading.** Add Doto and Geist Mono to `public/fonts/` and expose them via CSS variables (`--font-display`, `--font-mono`). Keep Noto Sans SC as the CJK fallback for `--font-ui` and `--font-head`.
5. **Icon strategy.** Functional icons are 1.5px-stroke SVGs, `currentColor`, 16–22px. Dot-matrix glyphs (9×9) are reserved for Empty State and decorative status; they must render as complete circles via CSS grid, never masks.
6. **Motion baseline.** All transitions use `ease-in-out`: 200ms for control states, 350ms for theme changes. No spring, bounce, or parallax.
7. **Pre-ship checks.** Before merging, verify: ≤2 red accent elements per screen; every active state is black↔white inversion; cards are glass/borderless; functional UI is sans-serif; standalone numerals use Doto.

---

## 4. Page Redesign — Marketing & Landing

This section applies the Nothing UI system to the public-facing pages in `frontend/cruip-landing`: the marketing landing route `/`, the shared global **Header** and **Footer**, the **Hero**, **CTA**, **Feature grids**, and the top of the `/download` catalog page.

> **Token reference:** All colors, type, spacing, radius, and motion values are defined in **Section 2 — Design Tokens**. No raw hex, arbitrary `px`, or ad-hoc font names should appear in the final markup.

### 4.1 Scope & user goals

| Area / Route | Current File(s) | Primary User Goal | Success Criteria |
|---|---|---|---|
| Global Header | `components/ui/header.tsx` | Navigate to key destinations and authenticate quickly | Persistent, scannable, never steals focus from content |
| Global Footer | `components/ui/footer.tsx` | Find legal links, resources, and social proof | Clear information hierarchy, no dead placeholder links |
| Marketing Landing `/` | `app/(marketing)/page.tsx` | Understand what MyWebDrive does and start using it | One-glance value prop, obvious primary action |
| Hero | `components/hero-home.tsx` | Be convinced to try the product | Restrained headline, single primary CTA, credible preview |
| Feature Grids | `components/features-grid.tsx`, `components/bento-demo.tsx` | Scan capabilities quickly | Consistent glass cards, no emoji-as-UI, monochrome first |
| CTA Band | `components/cta.tsx` | Take the final conversion step | High-contrast inverted band, single action |
| Download Catalog Top | `components/download/catalog-page.tsx` | Find the right asset for my platform | Fast filters, readable specs, obvious download entry points |

### 4.2 Nothing UI rules for marketing pages

1. **Monochrome first.** Black/grey/white carry hierarchy. The accent `#D71921` is reserved for signals only (live status, errors, badges, over-limit).
2. **Active controls invert black↔white.** Primary buttons, selected tabs, and current nav items use `--display` on `--bg` inversion. Never use red for active controls.
3. **No shadows, no gradients.** Depth comes from 1px hairlines (`--line`, `--line-2`), whitespace, and frosted-glass cards.
4. **Cards are glass, borderless, 8px radius.** Fill `var(--glass)` with `backdrop-filter: blur(12–16px)`. Hover = `translateY(-2px)`.
5. **Typography hierarchy:** standalone numbers and `%` use **Doto**; labels/data use **Geist Mono** uppercase; body/UI use Noto Sans SC for Chinese; page-level h1 may use ZCOOL XiaoWei; editorial italic only for one short brand line per view.
6. **Dot-field background** behind all marketing surfaces: sparse `~1.3px` dots at `~120px` spacing, `mix-blend-mode: difference`, `z-index: -1`, covered by cards.

```css
/* Page-level dot field — applied to marketing layout wrapper */
.marketing-layout::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px);
  background-size: 120px 120px;
  background-attachment: fixed;
  mix-blend-mode: difference;
}
```

### 4.3 Global shell

#### 4.3.1 Header

**Current:** `components/ui/header.tsx` uses a rounded white pill with shadows, brand-blue logo, and shiny text on actions.

**Redesign direction:** A narrow, fixed glass pill bar that inverts on active states.

| Field | Spec |
|---|---|
| **Purpose** | Persistent top navigation across marketing pages and catalog |
| **Variants** | `marketing` (logo + nav + auth), `catalog` (logo + nav + GitHub + submit) |
| **Structure** | Glass pill bar, 8px radius, height `56px`, max-width `1280px`, centered, `position: fixed`, `z-index: 50` |

**Props**
```typescript
interface HeaderProps {
  variant: 'marketing' | 'catalog';
  activePath?: string;
  count?: number; // optional Doto count shown in catalog variant
}
```

**States**

| State | Visual | Behavior |
|---|---|---|
| Default | Glass fill (`--glass`), 1px optional inner hairline (`--glass-brd`) | Bar floats 16–24px from top |
| Hover (links) | `opacity: 0.8` | Cursor pointer |
| Active / current route | `background: var(--display); color: var(--bg)` | Inversion, not red |
| Focus | `outline: 2px solid var(--focus)` | Visible keyboard ring only |
| Mobile open | Full-height sheet slides in from right | Backdrop blur on body |

**Responsive Behavior**

| Breakpoint | Behavior |
|---|---|
| Mobile (`<640px`) | Logo + hamburger icon; nav collapses into full-screen sheet |
| Tablet / Desktop | All links visible; auth actions at far right |

**Required Changes from Current**

- Remove shiny text effects.
- Remove `shadow-lg`, gradient border, and brand-blue fills.
- Replace `/login`, `/register` dead links with actual `/signin`, `/signup` routes.
- Use line SVG icons (1.5px stroke) for external links.

---

#### 4.3.2 Footer

**Current:** `components/ui/footer.tsx` uses heavy gradient text, a colored glow, brand-blue social icons, and many `href="#0"` placeholder links.

**Redesign direction:** A quiet, information-dense footer with hairline separators and monochrome links.

| Field | Spec |
|---|---|
| **Purpose** | Secondary navigation and legal/social links |
| **Variants** | `default` (marketing), `minimal` (catalog — single-row copyright + links) |
| **Structure** | Top hairline divider, 5-column grid on desktop, stacked on mobile |

**States**

| State | Visual |
|---|---|
| Default | `--bg` background, `--line` top hairline |
| Link hover | `opacity: 0.8` |
| Link focus | `--focus` ring |
| Social hover | `opacity: 0.8`, icon color stays `--primary` |

**Required Changes from Current**

- Remove giant gradient text, colored glow, and brand-blue icon fills.
- Replace social placeholders with actual MyWebDrive URLs.
- Use 1.5px stroke SVG icons, not filled multicolor icons.
- Keep copyright line small and `--secondary`.

### 4.4 Marketing landing page flow

The current `app/(marketing)/page.tsx` renders `Hero → BusinessCategories → GlobeDemo → BentoDemo → MarqueeDemo → CTA`.

Recommended Nothing-aligned flow:

1. **Header** (global)
2. **Hero** — value prop + primary CTA + product preview card
3. **Feature Grid** — 6 capability cards with dot-matrix icons
4. **Bento Grid** — 3–4 larger capability showcases (optional)
5. **CTA Band** — conversion push
6. **Footer** (global)

`BusinessCategories`, `GlobeDemo`, and `MarqueeDemo` are **out of scope for this redesign** and should either be removed or rebuilt later to match the monochrome/dot-matrix language. They currently introduce brand-blue gradients, glows, emojis, and motion that conflict with Nothing UI.

### 4.5 Hero redesign

**Current:** `components/hero-home.tsx` uses an anime avatar strip, split text animation, a shimmer gradient button, a dead “了解更多” link, and a shadowed terminal card with a gradient border.

**Redesign direction:** Calm, information-first hero with a single headline, one primary CTA, one secondary text action, and a frosted-glass preview card.

| Field | Spec |
|---|---|
| **Purpose** | Communicate product value and drive the first click |
| **Layout** | Centered column, max-width `900px`, generous top padding (`96px`+) |

**Props**
```typescript
interface HeroProps {
  headline: string;          // e.g. "安全存储，随时协作"
  subheadline: string;       // one sentence
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  preview?: React.ReactNode; // optional glass preview card
}
```

**Typography Rules**
- One short expressive line may use **Ma Shan Zheng** or **Newsreader Italic** as a page-level accent.
- The main h1 may use **ZCOOL XiaoWei** for Chinese display.
- All UI text (buttons, labels) uses Noto Sans SC / Geist Mono.

**Preview Card**
- Glass fill, 8px radius, no border, no shadow.
- Contains a minimal terminal/code snippet or product screenshot.
- Optional dot-matrix status indicator if showing real-time state.

**Required Changes from Current**
- Remove avatar strip (or replace with monochrome user avatars without shadows/borders).
- Remove shimmer button and gradient effects.
- Replace `href="#0"` with `/docs` or remove.
- Ensure headline is one concise sentence.

### 4.6 Feature grid redesign

**Current:** `components/features-grid.tsx` uses emoji icons, white cards with gray rings and shadows, and generic copy.

**Redesign direction:** A 6-card grid using 9×9 dot-matrix icons, glass cards, and mono labels.

| Field | Spec |
|---|---|
| **Purpose** | Quickly communicate core capabilities |
| **Layout** | 1 column mobile → 2 columns tablet → 3 columns desktop, gap `24px` |

**Props**
```typescript
interface FeatureGridProps {
  label?: string;            // e.g. "FEATURES"
  heading: string;
  items: {
    id: string;
    title: string;
    description: string;
    icon: string;            // registered 9×9 dot-matrix glyph name
  }[];
}
```

**Icon Rules**
- Replace all emoji with **9×9 dot-matrix glyphs** rendered as CSS grids of complete circles.
- Icon size driven by `--gs` (default `30px` for feature cards).
- Functional in-card actions use 1.5px stroke SVGs, not filled icons.

**Accessibility**
- Section has `aria-labelledby` pointing to the heading.
- Each card is a `<article>` with a heading.
- Icons are decorative and hidden from screen readers (`aria-hidden="true"`).

### 4.7 Bento grid reuse

**Current:** `components/bento-demo.tsx` / `components/magicui/bento-grid.tsx` uses shadows, gradient masks, and large filled icons.

**Redesign direction:** Keep the macro layout (3-column bento) but replace visual treatment.

| Field | Spec |
|---|---|
| **Purpose** | Showcase deeper product workflows in a dense, poster-style layout |
| **Layout** | 12-column poster grid, module gap `12px`, max-width `1480px` |

**Card Rules**
- All cells are glass, 8px radius, no border, no shadow.
- Background previews must be muted and monochrome; remove blur transitions and gradient masks.
- Titles use `--font-head`; descriptions use `--secondary`.
- CTA links are text-only or outline buttons.

### 4.8 CTA band redesign

**Current:** `components/cta.tsx` uses a dark rounded container, radial glow, gradient button, and `href="#0"`.

**Redesign direction:** A high-contrast inverted band or glass card with a single primary action.

| Field | Spec |
|---|---|
| **Purpose** | Final conversion push at the bottom of the landing page |
| **Layout** | Full-width inverted band or centered glass card |
| **Structure** | Heading + primary button only; no secondary choice |

**Props**
```typescript
interface CtaBandProps {
  heading: string;
  cta: { label: string; href: string };
  label?: string; // optional mono eyebrow, e.g. "GET STARTED"
}
```

**Required Changes from Current**
- Remove gradient button, radial glow, and stripe image.
- Replace `href="#0"` with `/signup` or `/download`.
- Do **not** use accent red for the CTA.

### 4.9 `/download` catalog top redesign

**Current:** `components/download/catalog-page.tsx` has a sticky local header, a hero bar with gradient text and gradient spec card, and a filter bar with native selects.

**Redesign direction:** Unify the catalog top with the global shell and apply Nothing UI to the hero/filter area.

#### 4.9.1 Catalog header

- Replace the local header bar with the global **Header** component in `catalog` variant.
- Show the GitHub star count as a **Doto** number inside a pill button if available.
- “提交工具” button uses outline style; hover opacity.

#### 4.9.2 Catalog hero bar

| Field | Spec |
|---|---|
| **Purpose** | Orient the user and surface platform coverage |
| **Layout** | 2-column grid on desktop: left text, right glass spec card |

**Left Column**
- Mono eyebrow label: `DOWNLOAD`
- Heading: `软件分发` (`--font-head`)
- Optional Doto count: `12 TOOLS`
- Subheadline `--secondary`
- 1–2 mono tags: `SHA256`, `amd64 / arm64`, `stable / beta / dev`

**Right Column: Spec Card**
- Glass card, 8px radius, 24px padding.
- 3 spec items in a row:
  - `macOS` — `Brew / DMG / Tar`
  - `Windows` — `winget / exe`
  - `Linux` — `deb / rpm / tar`
- Each item has a 1.5px stroke platform icon, a `--font-head` title, and `--secondary` description.

**Required Changes from Current**
- Remove gradient heading text and gradient spec card.
- Remove `rounded-2xl` borders; use 8px radius.
- Icons stay line SVGs.

#### 4.9.3 Filter bar

| Field | Spec |
|---|---|
| **Purpose** | Narrow the catalog by query, OS, architecture, and channel |
| **Layout** | Search input on left; filter controls on right; wrap on mobile |

**Props**
```typescript
interface FilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  os: OSFilter;
  arch: ArchFilter;
  channel: ChannelFilter;
  onOsChange: (v: OSFilter) => void;
  onArchChange: (v: ArchFilter) => void;
  onChannelChange: (v: ChannelFilter) => void;
}
```

**Controls**

| Control | Nothing UI Treatment |
|---|---|
| Search input | 6px radius, `--line-2` outline, focus `--primary` border, no glow |
| OS / Arch / Channel | Pill chips or native selects styled with `--line-2`; selected = inversion |
| Settings toggle | Icon-only button, 38px circle, line SVG |

**Accessibility**
- Search input has an associated `<label>` (visually hidden) or `aria-label`.
- Chip list is a `role="group"` with `aria-pressed` per chip.
- Settings button has `aria-label="筛选选项"`.

### 4.10 Responsive behavior summary

| Breakpoint | Header | Hero | Feature Grid | CTA | Catalog Top |
|---|---|---|---|---|---|
| **Mobile (`<640px`)** | Hamburger sheet; single CTA full-width | Single column, full-width buttons stacked | 1 column | Full-width inverted band | Filters stack vertically; spec card below heading |
| **Tablet (`640–1024px`)** | Full nav visible; actions compact | Max-width `640px` content | 2 columns | Centered content | 2-column spec card |
| **Desktop (`>1024px`)** | Full nav + auth buttons | Max-width `900px` centered | 3 columns | Centered glass or full band | 2-column hero + horizontal filters |

### 4.11 Accessibility requirements

- **Color:** All text meets 4.5:1 contrast. Accent red is used only for signals; never as the sole means of conveying state.
- **Focus:** Visible `:focus-visible` ring using `--focus` token on every interactive element.
- **Motion:** Respect `prefers-reduced-motion`. Dot-field background is pure CSS and safe; avoid parallax or spring animations.
- **Semantics:** each section uses `<section>` with a heading; cards use `<article>`; nav uses `<nav>` with `aria-label`.
- **Links:** No `href="#"` or `href="#0"` in final markup. Remove or wire to real routes.
- **Icons:** Decorative icons have `aria-hidden="true"`; functional icon-only buttons have `aria-label`.
- **Screen readers:** Headings follow a logical order (`h1` → `h2` → `h3`).

### 4.12 Pre-implementation checklist

- [ ] All new marketing components use tokens from Section 2; zero raw hex/px values.
- [ ] Accent red appears only for genuine signals (≤2 per viewport).
- [ ] Every active/selected state uses black↔white inversion, never red.
- [ ] Cards are glass, 8px radius, borderless, shadowless, hover `translateY(-2px)`.
- [ ] Dot-field is applied behind marketing surfaces; cards cover it.
- [ ] Standalone numbers use Doto; labels/data use Geist Mono uppercase.
- [ ] No gradients, glows, shimmer effects, or drop shadows on marketing surfaces.
- [ ] All placeholder links (`#0`, `#`) are replaced with real routes or removed.
- [ ] Feature-grid emojis are replaced with 9×9 dot-matrix glyphs.
- [ ] Header/Footer are consistent across `/` and `/download`.

---

## 5. Page Redesign — Admin Dashboard

The admin console (`/admin/*`) is a product surface, not marketing. It stays **dark-only** regardless of the landing-page theme or `prefers-color-scheme`. Apply the Nothing dark token set here and do not inherit the light-mode variables used on the marketing pages. Chinese marketing fonts (ZCOOL XiaoWei, Ma Shan Zheng) are **not** used inside the console; functional UI uses Geist, data/labels use Geist Mono, and standalone numerals use Doto.

Scope: `/admin/overview`, `/admin/users`, `/admin/notifications`, `/admin/invitations`, `/admin/publish`.

### 5.1 Admin-region tokens

See Section 2 for the full token dictionary. The console requires these **dark-only overrides** scoped to `.admin-shell` (or equivalent region wrapper):

| Token | Value | Use in admin console |
|---|---|---|
| `--bg` | `#000000` | console canvas |
| `--surface` | `#0C0C0C` | command palette, dialogs, dropdown menus |
| `--raised` | `#171717` | hovered table rows, active sidebar item, kbd shortcuts |
| `--line` | `#262626` | table/divider hairlines |
| `--line-2` | `#3A3A3A` | input outlines, button outlines |
| `--muted` | `#5A5A5A` | placeholder text, disabled icons |
| `--secondary` | `#8C8C8C` | column labels, captions, secondary data |
| `--primary` | `#EDEDED` | body text, default icons |
| `--display` | `#FFFFFF` | headings, inverted fills |
| `--glass` | `rgba(16,16,16,.9)` | card fill |
| `--glass-brd` | `rgba(255,255,255,.09)` | optional inner card hairline |
| `--accent` | `#D71921` | signal fills only: live badge, over-limit cells, error banner, notification dot |
| `--accent-text` | `#FF4438` | signal foreground on dark |
| `--success` | `#7BE38A` | healthy status values only |
| `--warning` | `#F2C94C` | pending/caution values only |
| `--error` | `#FF5247` | error values only |

**Typography for the console**

| Role | Token / Font | Use |
|---|---|---|
| UI / body | `--font-ui` Geist 400 | buttons, inputs, card titles, nav labels |
| Headline | `--font-head` Geist 600 | page titles, card titles, dialog titles |
| Mono / data | `--font-mono` Geist Mono 400 | table cells, timestamps, quotas, uppercase labels |
| Dot display | `--font-display` Doto (`ROND` 100, ≤500) | standalone numbers and their `%` sign, metric values |

**Geometry for the console**

- Spacing: 4px grid: `8 / 12 / 16 / 20 / 24 / 32 / 40`.
- Card radius: `--r-md` = 8px.
- Control radius: `--r-sm` = 6px.
- Pill radius: `--r-pill` = 999px (status pills, tabs, segmented bar tracks).
- Hairlines: 1px only.
- Motion: `ease-in-out`, 200ms controls, 350ms theme/region transitions.

### 5.2 Console layout shell

Replace the current top-only admin navigation with a fixed **sidebar + top command bar** product shell. Keep the footer out of the console.

#### Component: `AdminShell`

**Purpose:** Wraps every `/admin/*` route in a dark, fixed-layout region with local dot-field, sidebar navigation, top search/command palette, and main content area.

**Structure**
```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar 240px]  │  [Top bar 56px]                         │
│                   │  ─────────────────────────────────────  │
│   Logo            │                                         │
│   Nav             │           [main content]                │
│   (icons + mono   │                                         │
│    labels)        │                                         │
│                   │                                         │
│   User            │                                         │
│   bottom          │                                         │
└─────────────────────────────────────────────────────────────┘
```

**Tokens**
- Sidebar: `--surface` fill, 1px `--line` right hairline.
- Top bar: `--bg` fill, 1px `--line` bottom hairline, height 56px.
- Main area: `--bg` fill, padding 24px, scrollable.
- Region wrapper: `position: relative; isolation: isolate;` so the local dot-field `::before` only inverts against the dark console.

**Dot field (local)**
```css
.admin-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,.42) 1.3px, transparent 1.7px);
  background-size: 120px 120px;
  background-attachment: fixed;
  mix-blend-mode: difference;
}
```

### 5.3 Navigation sidebar

#### Component: `AdminSidebar`

**Purpose:** Persistent primary navigation for admin routes.

**Visual**
- Width 240px, fixed left, full height.
- Background `--surface`, 1px `--line` right hairline.
- Nav items are stacked rows, height 40px, padding 12px 16px, 8px gap between icon and label.
- Icon: 1.5px stroke SVG, 20px, color `--secondary` default.
- Label: `--font-mono`, uppercase, 11px, letter-spacing `.08em`, color `--secondary`.

**States**

| State | Visual |
|---|---|
| Default | icon `--secondary`, label `--secondary`, transparent bg |
| Hover | bg `--raised`, icon/label `--primary` |
| Active/current route | bg `--raised`, left 2px `--display` indicator bar, icon `--display`, label `--display` |
| Collapsed (mobile) | sheet drawer, same styling, 280px width |

**Items**

| Route | Label (zh) | Icon |
|---|---|---|
| `/admin/overview` | 概览 | LayoutGrid |
| `/admin/users` | 用户 | Users |
| `/admin/notifications` | 通知 | Bell |
| `/admin/invitations` | 邀请码 | Ticket |
| `/admin/publish` | 发布 | Upload |
| `/admin/storage` (existing) | 存储 | HardDrive |

Use `aria-current="page"` on the active item.

### 5.4 Command palette / global search

#### Component: `AdminCommandPalette`

**Purpose:** Keyboard-first global navigation and action runner for the admin console (`⌘K` / `Ctrl+K`).

**Visual**
- Trigger: a button in the top bar, `--line-2` 1px outline, 6px radius, height 32px.
  - Left: search icon (16px, `--secondary`).
  - Middle: placeholder "搜索页面、操作或用户…" in `--muted`.
  - Right: `⌘ K` kbd badge on `--raised`.
- Palette: modal surface `--surface`, 560px max-width, 8px radius, no shadow.
- Backdrop: `--bg` at 80% opacity, no blur shadow.

**Sections**
1. **Recent** — last 5 visited admin routes.
2. **Pages** — static admin routes with mono labels.
3. **Actions** — e.g., "创建邀请码", "刷新用户列表", "导出通知".
4. **Users** — typeahead results (debounced 250ms); show avatar placeholder + email + role pill.

**Item row**
- Height 40px, padding 12px 16px.
- Left icon 16px `--secondary`.
- Title in `--primary`.
- Right shortcut in `--font-mono` uppercase `--muted`.
- Hover/selected: bg `--raised`.
- Active action: no accent; selected row inverts to `--display` bg + `--bg` text.

**Accessibility**
- `role="dialog"`, `aria-modal="true"`.
- `aria-label="命令面板"`.
- Arrow keys navigate, `Enter` executes, `Esc` closes.
- Live region announces result count on search.

### 5.5 `/admin/overview`

**Page purpose:** High-level system health and trend dashboard.

**Layout**
- Page header: title "系统概览" (`--font-head` 24px) + segmented range control + refresh button.
- Metric grid: 4 columns on desktop, 2 on tablet, 1 on mobile, gap 12px.
- Below metrics: two chart cards side by side on desktop, stacked on mobile.

#### Component: `MetricCard`

**Purpose:** Display a single KPI with a dot-display value and a mono label.

**Visual**
- Glass card, 8px radius, 20px padding.
- Label: `--font-mono` uppercase, 10px, letter-spacing `.1em`, `--secondary`.
- Value: `--font-display` Doto, 40px, `--display`. Unit/`%` stays Doto; suffix such as "GB" / "ms" uses `--font-mono` 14px.
- Optional delta row: `↑ 12%` or `↓ 4%` in `--success`/`--error` (value only, not label).
- Hover: `translateY(-2px)`.

**Props**
```typescript
interface MetricCardProps {
  label: string;          // uppercase mono label
  value: string | number; // rendered in Doto
  unit?: string;          // mono suffix
  delta?: number;         // positive = success, negative = error
  loading?: boolean;
  error?: boolean;
}
```

**States**

| State | Visual |
|---|---|
| Idle | label + Doto value + optional delta |
| Loading | label shown; value replaced by `[LOADING…]` in `--font-mono` `--muted`, no skeleton screens |
| Error | label shown; value replaced by `--error` `[ERROR]` mono badge |
| Empty | value shows `-` in Doto |

**Metrics to show**

| Label | Value source | Notes |
|---|---|---|
| 用户总数 | `totals.total_users` | Doto integer |
| 文件总数 | `totals.total_files` | Doto integer |
| 存储总量 | `totals.total_storage_bytes` | format to `TB`/`GB`, e.g., `2.4 TB` where `2.4` is Doto and `TB` is mono |
| 今日上传 | `today.uploads_bytes` | compact bytes |
| 今日下载 | `today.downloads_count` | Doto integer |
| 请求总数 | `today.requests_count` | Doto integer |
| 错误总数 | `today.errors_count` | Doto integer; turn `--accent-text` only if > 0 (signal) |
| P95 延迟 | `today.latency_ms_p95` | value in Doto, `MS` mono |

#### Range control

- Use pill tabs: "今天 / 7天 / 30天".
- Active tab: `--display` fill, `--bg` text (inversion).
- Inactive tab: transparent, `--primary` text, hover `opacity: .8`.

#### Charts

- Replace area-chart gradients with **line charts only**; gradients are forbidden.
- Stroke: `--display` 1.5px for primary series; `--secondary` 1.5px for secondary series.
- Grid: 1px `--line` horizontal ticks only, no vertical grid.
- Axis labels: `--font-mono` 10px, `--muted`.
- Tooltip: glass card, 8px radius, value in Doto.
- Empty chart: dashed 1px `--line-2` box, 9×9 dot-matrix `chart` glyph, `--secondary` text "无数据".

### 5.6 `/admin/users`

**Page purpose:** Search, list, role-manage, and quota-manage users.

**Layout**
- Page header: title "用户管理" + global search input + refresh button.
- Filter bar: search input, role filter chips, storage-status segmented bar summary.
- Data table.
- Pagination bar.
- Quota dialog.

#### Data table spec

**Table: `UsersTable`**

- Background: transparent; rows separated by 1px `--line` bottom hairline.
- Header row: `--font-mono` uppercase, 10px, letter-spacing `.1em`, `--secondary`, no bottom border or 1px `--line-2`.
- Row height 48px.
- Hover row: bg `--raised`.
- Active/selected row: bg `--raised` + 2px `--display` left indicator.

**Columns**

| Column | Alignment | Content |
|---|---|---|
| 选择 | left | checkbox, 40px wide |
| ID | left | mono 11px `--primary`; copy icon button (ghost, 32px) |
| EMAIL | left | `--primary` 14px |
| 姓名 | left | `--primary` 14px; `-` if null |
| 角色 | left | status pill: `ADMIN` inverted, `USER` outline |
| 创建时间 | left | mono 11px `--secondary` |
| 操作 | right | "详情" text button + "配额" text button |

#### Status pills

Use the unified pill system:

| Variant | Visual |
|---|---|
| `pill.active` | `--display` fill, `--bg` text, pill radius |
| `pill.inactive` | 1px `--line-2` outline, `--primary` text, pill radius |
| `pill.signal` | `--accent` fill, `--accent-ink` text; only for over-limit / error |

#### Quota dialog

- Dialog surface `--surface`, 8px radius, max-width 480px.
- Show "已用 / 配额" as Doto numbers + mono unit.
- Quota input: 6px radius, `--line-2` outline, focus `--primary` border.
- Slider: track `--line`, fill `--display`, knob `--display` circle; no accent.
- Save button: primary inversion. Cancel: text button.

### 5.7 `/admin/notifications`

**Page purpose:** Operational event feed with filtering, batch actions, live SSE updates, and detail drawer.

**Layout**
- Page header: title "通知中心" + unread count pill + live toggle + refresh.
- Filter bar: severity tabs, search, date range, service filter, unread-only switch.
- Data table with checkboxes.
- Batch action bar (appears on selection).
- Right detail drawer.

#### Severity system

Map severities to Nothing states. Use **shape + label first, color second**.

| Severity | Pill | Icon |
|---|---|---|
| `critical` | `pill.signal` `--accent` fill, label "紧急" | 9×9 dot glyph `alert` in `--accent-text` |
| `warning` | `pill.inactive` outline + `--warning` text, label "警告" | 9×9 dot glyph `warn` |
| `info` | `pill.inactive` outline + `--primary` text, label "信息" | line SVG info icon |
| `success` | `pill.inactive` outline + `--success` text, label "运维" | line SVG check |

#### Live toggle

- A button with a 8px dot to its left.
- When live: dot is `--accent` with a subtle pulse (opacity 1 → .6 → 1, 1.5s ease-in-out); label reads "实时中".
- When off: dot is `--muted`; label reads "开启实时".
- The accent here is legitimate: it signals a live/recording state.

#### Batch action bar

- Sticky bottom bar, `--surface` fill, 1px `--line` top hairline, height 56px.
- Shows selection count in Doto + actions: "标记已读" (primary inversion), "导出" (outline), "删除" (text button `--error` text only).
- No destructive red fill buttons.

#### Detail drawer

- Width 420px (540px on large screens), `--surface` fill, 1px `--line` left hairline.
- Header: notification title `--font-head` 18px.
- Meta: mono 11px `--secondary`.
- Body: formatted description in `--primary`.

### 5.8 `/admin/invitations`

**Page purpose:** Create, list, copy, and revoke invitation codes.

**Layout**
- Page header: title "邀请码" + "创建" primary button + refresh.
- Data table.
- Create dialog.

#### Table columns

| Column | Content |
|---|---|
| CODE | mono 12px `--primary` |
| 状态 | `pill.active` "有效" or `pill.inactive` "已停用" |
| 已用/限制 | Doto `usedCount`, mono `/`, Doto `usageLimit` |
| 过期时间 | mono 11px `--secondary`; `-` if none |
| 备注 | `--primary` 14px |
| 操作 | copy-link, copy-code, revoke text buttons |

#### Segmented usage bar

#### Component: `SegmentedBar`

**Purpose:** Show discrete capacity or progress with square cells; used here for invitation usage and later for storage quotas.

**Visual**
- Container: flex row, 2px gaps, no radius.
- Total cells = `usageLimit` (cap visual at 20 cells; if limit > 20, each cell represents `ceil(limit/20)`).
- Filled cells: `--display`.
- Empty cells: `--line`.
- Over-limit cells (used > limit): `--accent` (signal).
- Numeric readout to the right in Doto + mono label "USED / LIMIT".

**Example:** `used=7, limit=10` → 7 white cells + 3 dark cells + "7 / 10" Doto/mono text.

#### Create dialog

- Fields: usage limit (number input), expires at (datetime-local), notes (input).
- Primary action "创建" with inversion fill.
- On success, show inline status `[CREATED]` mono `--success`; no toast popup.

### 5.9 `/admin/publish`

**Page purpose:** Publish a file to the public download catalog.

**Layout**
- Page header: title "发布管理".
- Two-column layout on desktop, single column on mobile, gap 24px.
- Left: file search + selectable file list.
- Right: publish form.
- Preview dialog.

#### File list (left card)

- Glass card, 8px radius.
- Search input + search button.
- File rows: 1px `--line` separators, hover `--raised`, selected row `--raised` + 2px `--display` left indicator.
- Row content: filename `--primary`, size in Doto + `MB` mono, ID mono 10px `--muted`.

#### Publish form (right card)

- Form sections separated by 1px `--line` (not cards within cards).
- Labels: `--font-mono` uppercase 10px `--secondary`.
- Inputs/selects: 6px radius, `--line-2` outline, focus `--primary` border.
- Channel/OS/Arch: use pill chips; active chip inverted.
- Public toggle: switch ON = white track + black knob (inversion).
- Submit button: primary inversion, full width on mobile.

### 5.10 State coverage by page

| Page | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| `/admin/overview` | metric cards show `[LOADING…]`; charts show line skeletons | "无数据" dashed box | page-level inline alert | show cached metrics + banner |
| `/admin/users` | table line skeletons | empty state with "创建用户" CTA if applicable | inline alert above table | render rows + retry banner |
| `/admin/notifications` | table line skeletons; live toggle disabled | empty state "暂无通知" | inline alert | render rows + retry banner |
| `/admin/invitations` | table line skeletons | empty state "创建邀请码" | inline alert | render rows + retry banner |
| `/admin/publish` | file list skeletons; form disabled | empty file list | inline alert | show form + file list banner |

### 5.11 Motion & interaction

- All transitions `ease-in-out`.
- Card hover: `translateY(-2px)` 200ms.
- Button hover: `opacity: .8` 150ms.
- Row hover: background 150ms.
- Dialog enter: opacity 200ms + translateY(8px → 0) 200ms.
- Drawer enter: translateX(100% → 0) 250ms.
- Live dot pulse: opacity 1500ms ease-in-out infinite.
- No spring, no bounce, no parallax.

### 5.12 Accessibility

- Sidebar: `aria-current="page"` on active route.
- Command palette: `role="dialog"`, `aria-modal="true"`, arrow-key navigation, `Esc` to close.
- Tables: `scope="col"` on headers; selectable rows use `aria-selected`.
- Live updates: `aria-live="polite"` region for new notification count.
- Focus: 2px `--focus` ring on keyboard focus.
- Color alone never communicates status: combine color with label/text/icon shape.

### 5.13 Implementation boundaries

- Do **not** use the current brand primary `#3388BB` or accent magenta `#881144` in the admin console.
- Do **not** use shadows, gradients, or colored button fills for primary actions.
- Do **not** use the marketing Chinese display fonts inside reusable admin components.
- Do **not** use toast popups; use inline status, banners, or `[LOADING…]` / `[SAVED]` mono labels.
- Do **not** add a marketing footer inside `/admin/*`.

### 5.14 Acceptance checklist

- [ ] Admin shell is dark-only and ignores landing light/dark toggle.
- [ ] Dot field uses `mix-blend-mode: difference` and sits behind cards only.
- [ ] Zero raw hex/px/radii values: all values reference tokens.
- [ ] ≤2 red accent elements per screen; every accent usage is a genuine signal.
- [ ] All primary buttons and active controls use black↔white inversion.
- [ ] Standalone numbers and `%` use Doto; labels/data use Geist Mono uppercase.
- [ ] Cards are glass, 8px radius, borderless, hover `translateY(-2px)`.
- [ ] Loading states use `[LOADING…]` or line skeletons, no gradient shimmer skeletons.
- [ ] Tables have no zebra striping; hover row uses `--raised`.
- [ ] Command palette reachable via `⌘K` / `Ctrl+K`.

---

## 6. Page Redesign — Auth, Download Catalog & Docs

Scope: `/signin`, `/signup`, `/reset-password` (App Router auth group); `/download` catalog page; and the Nextra docs site (`/docs`). All redesigns adopt the Nothing UI monochrome + signal-red language. Values come from Section 2 tokens; raw hex, shadows, gradients, and brand blue `#3388BB` / magenta `#881144` are removed.

### 6.1 Auth pages

#### 6.1.1 Layout

| Decision | Specification |
|---|---|
| Page shell | Remove the current gradient orb and the decorative code-card panel. |
| Background | Apply the global dot-field layer (`body::before`, `z-index:-1`, `mix-blend-mode:difference`, `1.3px` dots, `120px` spacing). |
| Canvas | Light theme: `--bg #F2F2F2`. Dark theme: `--bg #000`. |
| Form container | Centered single frosted-glass card on mobile; on `lg+`, a narrow left-aligned card (`max-w-sm`) with generous whitespace. No split-screen illustration. |
| Header | Keep the minimal `Logo` only; remove marketing header links so auth stays task-focused. |

#### 6.1.2 Form structure

```markdown
[Card: glass, r-md, p-6 md:p-8]
  [H1: --f-head, 24px, --display]   登录到您的账户 / 创建您的账户 / 重置密码
  [Alert (conditional): error variant, 3px left border]
  [Form stack: gap-4]
    [Field]
      [Label: --f-mono, uppercase, 11px, --secondary] 邮箱
      [AuthInput]
    [Field]
      [Label: --f-mono, uppercase, 11px, --secondary] 密码
      [AuthInput type=password]
    [SignUp only: name + invitation code fields]
    [AuthButton primary fullWidth]  登录 / 注册 / 发送重置链接
  [Footer link: --secondary, hover opacity .8] 忘记密码 / 返回登录
```

#### 6.1.3 Components

**Component: AuthInput**

| Attribute | Spec |
|---|---|
| Purpose | Single-line text entry for email, password, name, and invitation code. |
| Variants | `default`, `error` |
| States | Default: `bg-transparent`, 1px bottom hairline `--line-2`, text `--primary`; Focus: bottom hairline becomes `--display` (no glow, no ring); Error: bottom hairline `--error`, below-text `--error`; Disabled: opacity `.3`. |
| Typography | Value in `--f-ui` 16px; placeholder in `--muted`. |
| Geometry | Height `44px`, no border-radius on the underline variant (or `6px` if boxed outline variant is chosen); padding `0 0 12px 0` for underline. |
| Motion | Border-color transition `200ms ease-in-out`. |

**Component: AuthButton**

| Attribute | Spec |
|---|---|
| Purpose | Primary form submission. |
| Variants | `primary`, `text` |
| States | Primary default: `--display` fill, `--bg` text; Hover: `opacity .8`; Active/pressed: `opacity .6`; Disabled: `opacity .3`; Loading: spinner + reduced-opacity label. **No red fill.** |
| Typography | `--f-mono`, uppercase, 12px, tracking `.06em`. |
| Geometry | Height `44px`, radius `6px`, full width inside form. |

**Component: AuthAlert**

| Attribute | Spec |
|---|---|
| Purpose | Inline server/validation error feedback. |
| Visual | Left border `3px` `--error`; faint `color-mix(in srgb, --error 9%, transparent)` background; text `--primary`. |
| Typography | `--f-ui` 14px; no icon fill colors except `--primary`/`--error`. |
| Geometry | Radius `6px`, padding `12px 16px`. |

#### 6.1.4 Validation states

| State | Visual Rule |
|---|---|
| Empty required | Submit reveals `AuthAlert` summarizing missing fields; individual fields switch to `error` variant. |
| Invalid email | Field switches to `error` variant; helper text: `--error` 12px `--f-ui`. |
| Weak password | Use `error` variant only; do not use accent for neutral guidance. |
| Server error | `AuthAlert` with the message; no toast popups. |
| Success / reset sent | Inline `success` alert (left border `3px` `--success`, 9% tint) or redirect to `/signin`. |

### 6.2 Download catalog page (`/download`)

#### 6.2.1 Layout

| Decision | Specification |
|---|---|
| Background | Light or dark page theme with dot-field; catalog cards sit on top and cover the dots. |
| Header | Sticky glass bar (`--glass`, `backdrop-filter: blur(16px)`), 1px bottom hairline `--line`; height `56px`; z-index `40`. |
| Hero | Two-column grid (`md`). Title in `--f-head` `--display`, 32px. Subtitle in `--secondary` `--f-ui`. Remove gradient text and gradient card. |
| Stats strip | Three frosted-glass mini-cards (`r-md`, no border), each with a 1.5px line icon and mono label. |
| Filter bar | Sticky below header on scroll optional; keep hairline separation. |
| Grid | `gap-6`, `sm:grid-cols-2`, `lg:grid-cols-3`, max-width `1480px` (`outer`). |

#### 6.2.2 Filter bar

```markdown
[FilterBar: flex wrap, gap-3, md:justify-between]
  [SearchField: glass input, Search icon left, 1px --line-2 hairline]
  [FilterGroup: gap-2]
    [Select: OS]
    [Select: Arch]
    [Select: Channel]
  [CategoryTabs: underline or pill style]
```

**Component: CatalogSelect**

| Attribute | Spec |
|---|---|
| Purpose | OS / Arch / Channel filter. |
| Visual | Outlined pill/chip: 1px `--line-2`, radius `6px`, `--primary` text; Open menu on `--surface`; Hover item on `--raised`. |
| Active | Selected option uses inversion (`--display` fill, `--bg` text), not red. |
| Typography | Label `--f-mono` uppercase 11px; value `--f-ui` 14px. |

**Component: CategoryTabs**

| Attribute | Spec |
|---|---|
| Purpose | Category chips (`全部`, `基础工具`, `写作工具`, `模型`, etc.). |
| Visual | Pill chips with 1px `--line-2`; gap `8px`. |
| Active | Inversion fill (`--display` on `--bg`). |
| Typography | `--f-mono` uppercase 11px. |

#### 6.2.3 Catalog cards

**Component: ProjectCard**

| Attribute | Spec |
|---|---|
| Purpose | Display one downloadable project with its primary asset action. |
| Visual | Glass card (`--glass`, `backdrop-filter: blur(12px)`), radius `--r-md` (`8px`), no border, no shadow. Hover: `translateY(-2px)` `200ms ease-in-out`. |
| Header | Title `--f-head` 18px `--display`; category label `--f-mono` uppercase 10px `--secondary`. |
| Body | Description `--f-ui` 14px `--secondary`, `line-clamp-2`. |
| Meta row | Version `v1.8.3` in `--f-mono` 11px uppercase; channel `stable` as outlined pill; license as text `--muted`. **No colored badges.** |
| Actions | Primary `下载` button (inversion fill); secondary copy-command icon button (1px `--line-2` square, `6px` radius); `版本与日志` text button. |
| Asset dropdown | Menu on `--surface`, hairline separators, asset name `--f-ui`, size `--f-mono` `--secondary`. |

**Component: ProjectModal**

| Attribute | Spec |
|---|---|
| Purpose | Full release history and asset list. |
| Visual | Glass dialog (`--glass`, `r-md`), overlay `bg #000/60` no blur shadow. |
| Header | Title `--f-head` 20px `--display`; close icon button. |
| Release block | Hairline top separator; version in `--f-mono` 11px uppercase; date `--muted`; channel pill; changelog link `--secondary` hover opacity. |
| Asset grid | `sm:grid-cols-2`, each asset row is a hairline-outlined cell (`1px --line`, `r-sm` 6px), hover `--raised`. |

#### 6.2.4 Empty / error states

| Scenario | Visual |
|---|---|
| No matching assets | Centered dashed hairline box (`border: 1px dashed --line-2`), 9×9 dot-matrix glyph, `--f-head` title, one `.btn-primary`. |
| Catalog fetch failed | Inline `error` alert; retry button. |

### 6.3 Nextra docs site (`/docs`)

#### 6.3.1 Theme overrides

Nextra theme config and global CSS must be overridden. Keep Nextra for MDX routing/search/TOC; replace visual tokens.

| Area | Rule |
|---|---|
| Page background | `--bg` with dot-field layer. |
| Article container | Max width `768px` for prose; padding `24px–40px`; no card shadow. |
| Sidebar | `--surface`, 1px right hairline `--line`; nav items `--f-ui` 14px. |
| Active nav item | `--raised` background + 2px left `--display` indicator (not accent). |
| Search input | Glass input, 1px `--line-2`, `--f-mono` placeholder, open results on `--surface`. |
| TOC | Title `--f-mono` uppercase 11px `--secondary`; links `--secondary` hover opacity. |
| Footer / edit link | `--muted`, hover opacity. |

#### 6.3.2 Typography

| Element | Token |
|---|---|
| H1 | `--f-head` 32px `--display`, line-height 1.2 |
| H2 | `--f-head` 24px `--display`, margin-top `48px`, hairline bottom separator optional |
| H3 | `--f-head` 20px `--primary` |
| Body | `--f-ui` 16px `--primary`, line-height 1.5 |
| Strong | `--display`, same weight family |
| Links | `--primary`, hover `opacity .8`, no underline; external link icon 1.5px stroke |
| Lists | `--primary`; bullets as small `--secondary` dots |

> Editorial italic: allowed only for a one-line brand phrase (e.g. hero subtitle). Never inside reusable docs components.

#### 6.3.3 Code blocks

**Component: DocsCodeBlock**

| Attribute | Spec |
|---|---|
| Purpose | Render fenced code in MDX. |
| Visual | Background `--surface`; 1px hairline `--line`; radius `--r-md` (`8px`); no shadow. |
| Header (filename/lang) | `--raised` strip, `--f-mono` uppercase 11px `--secondary`, radius-top inherits. |
| Text | `--f-mono` 13px `--primary`; syntax tokens use muted greys/white only, with `--accent-text` reserved for genuine errors/strings if needed. |
| Copy button | `btn-icon` 38px circle, 1.5px stroke icon, hover opacity. |
| Inline code | `--raised` background, `--f-mono` 13px `--primary`, radius `4px`, padding `2px 4px`. |

#### 6.3.4 Callouts

**Component: DocsCallout**

| Attribute | Spec |
|---|---|
| Purpose | Info / warning / error annotations in MDX. |
| Visual | Left border `3px` semantic color; 9% tint background via `color-mix`; no emoji. |
| Types | `info`: left border `--secondary`; `warning`: left border `--warning`; `error`: left border `--error`. |
| Typography | Title `--f-head` 16px `--display`; body `--f-ui` 14px `--primary`. |

#### 6.3.5 Tables

| Rule | Spec |
|---|---|
| Header row | `--f-mono` uppercase 11px `--secondary`, bottom hairline `--line`. |
| Cells | `--f-ui` 14px `--primary`; numeric data `--f-mono` right-aligned. |
| Rows | Hairline separators; **no zebra striping**. |
| Hover row | `--raised` background. |

### 6.4 Motion & interaction checklist

- Easing: `ease-in-out` only.
- Control transitions: `200ms`.
- Theme transitions: `350ms`.
- Card hover: `translateY(-2px)`.
- Button hover: `opacity .8`.
- Input focus: hairline color change only, no ring glow.
- Active/selected: black↔white inversion, never accent.

### 6.5 Anti-patterns to remove

| Current Pattern | Replacement |
|---|---|
| `bg-linear-to-tr`, `blur-[160px]` gradient orb | Dot-field background |
| `shadow-xl`, `shadow-sm` | Nothing; use z-index and glass |
| `bg-gradient-to-r` text | `--display` solid text |
| Brand blue `#3388BB` buttons | `--display` inversion buttons |
| Brand magenta `#881144` accents | `--accent` only for signals |
| Rounded `2xl` cards/hero boxes | `--r-md` (`8px`) |
| Toast notifications | Inline alerts |
| Emoji in callouts/headings | Dot-matrix glyphs or plain text |
| Colored badges for version/channel | Outlined pills / mono labels |
| Zebra-striped tables | Hairline rows + `--raised` hover |

---

## 7. Implementation Roadmap & Acceptance Criteria

This section turns the Nothing UI design system into an executable migration plan for `frontend/cruip-landing`.

### 7.1 Phased rollout

| Phase | Duration | Scope | Key Deliverables | Exit Criteria |
|---|---|---|---|---|
| **P1 · Tokens & Foundations** | 1 week | CSS tokens, fonts, theme wiring, dot-field base | `app/css/nothing-tokens.css`, `app/css/nothing-base.css`, font files in `public/fonts/open/`, updated `app/layout.tsx` | `next build` passes; both `data-theme="dark"` and `"light"` render without raw hex in source |
| **P2 · Primitives** | 2 weeks | Refactor shadcn/ui primitives to Nothing variants | `components/ui/button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `tabs.tsx`, `table.tsx`, `checkbox.tsx`, `switch.tsx`, `select.tsx`, `dialog.tsx` | All primitives render every variant/story; zero `box-shadow` or gradient utilities remain in these files |
| **P3 · Pages & Layouts** | 2 weeks | Apply primitives to each route group | `(marketing)/page.tsx`, `(auth)/*`, `(default)/download/*`, docs theme config, `admin/*` (dark-locked) | Every route in `docs/site-map.md` renders in both themes (admin in dark only); placeholder links fixed or removed |
| **P4 · QA & Polish** | 1 week | Visual regression, a11y, perf, pre-ship checklist | Checklist signed off, screenshot diff report, Lighthouse scores | All acceptance criteria below pass; no P1/P2 regressions |

**Sequencing rules:**
- P2 must not start until P1 tokens are frozen.
- P3 page work can begin on isolated routes (e.g., auth) as soon as the primitives they need are ready; the marketing landing should be last because it touches the most composites.
- P4 is gated by a complete run of the pre-ship checklist in §7.5.

### 7.2 Migration steps from current Tailwind/Cruip

#### 1. Snapshot and baseline
```bash
cp frontend/cruip-landing/app/css/style.css \
   frontend/cruip-landing/app/css/style.css.pre-nothing.bak
cp frontend/cruip-landing/tailwind.config.js \
   frontend/cruip-landing/tailwind.config.js.pre-nothing.bak
```
- Run `npm run build` and capture current bundle size / Lighthouse scores as the baseline.

#### 2. Add Nothing tokens without removing Tailwind yet
- Create `app/css/nothing-tokens.css` with the full token map from Section 2.
- Import it **before** the existing `@theme` block in `style.css` so legacy utilities still compile while new code uses tokens.
- Do **not** delete old `--color-brand-primary-*` or `--color-brand-accent-*` variables until P3 is complete.

#### 3. Install fonts
- Place the four SIL OFL font families under `public/fonts/open/`:
  - `Doto-ROND-wght.ttf`
  - `Geist-Regular.ttf`, `Geist-SemiBold.ttf`
  - `GeistMono-Regular.ttf`
  - `Newsreader-Italic.ttf`
- Update `app/layout.tsx` to load them via `next/font/local`. Keep Noto Sans SC as a temporary fallback body font.

#### 4. Establish the dot-field layer
- Add the canonical dot-field rule to `app/css/nothing-base.css`.
- For the always-dark admin dashboard, add the same rule scoped to `.appwrap::before`.

#### 5. Refactor primitives one by one
- For each file in `components/ui/`, follow the component spec template.
- Replace raw values with token references:
  - `rounded-md` → `rounded-[var(--r-md)]` (8px for cards)
  - `shadow-*` → remove
  - `bg-white/95` → `bg-glass backdrop-blur-[14px]`
  - `hover:bg-gray-100` → `hover:opacity-80` for controls, `hover:-translate-y-0.5` for cards
- Active states must invert `display` ↔ `bg`.

#### 6. Replace brand colors with semantic monochrome
- `#3388BB` → remove from UI; reserve for any remaining logo asset only.
- `#881144` → replace with `--accent` only if the element is a genuine signal; otherwise convert to `--display`/`--primary`/`--secondary`.

#### 7. Remove shadows and gradients
- Delete or replace all `shadow-*`, `drop-shadow-*`, gradient utilities, `ShimmerButton`, `shine` keyframes, and gradient animations.

#### 8. Migrate pages route by route
- Use the page inventory from Sections 4–6. For each page:
  1. Swap in the refactored primitives.
  2. Apply the correct layout wrapper (light marketing, light auth, or dark admin).
  3. Replace marketing copy fonts.
  4. Verify the dot field is visible between cards but covered by card faces.

#### 9. Lock dashboards to dark
- Admin pages (`app/admin/*`) must render inside a region that pins the dark token set regardless of the global theme toggle.

#### 10. Final cleanup
- Remove pre-Nothing backups once P4 passes.
- Delete unused old font files if the Chinese fallback strategy is finalized.

### 7.3 File locations

| Layer | Target Path | Notes |
|---|---|---|
| **Tokens** | `frontend/cruip-landing/app/css/nothing-tokens.css` | Full `:root` dark + `[data-theme="light"]` token map from Section 2. Imported at the top of `style.css`. |
| **Base / dot field** | `frontend/cruip-landing/app/css/nothing-base.css` | Dot-field `body::before`, `.appwrap` dot-field, and token-based base resets. |
| **Fonts** | `frontend/cruip-landing/public/fonts/open/` | Doto, Geist, Geist Mono, Newsreader Italic plus license files. |
| **Root layout** | `frontend/cruip-landing/app/layout.tsx` | Loads local fonts, sets `data-theme`, wraps children in `ThemeProvider`. |
| **Marketing layout** | `frontend/cruip-landing/app/(marketing)/layout.tsx` | Light-first page wrapper; allows editorial italic in page-level copy. |
| **Default layout** | `frontend/cruip-landing/app/(default)/layout.tsx` | Shared by `/download`, `/article`, `/tutorials`. |
| **Auth layout** | `frontend/cruip-landing/app/(auth)/layout.tsx` | Minimal background, form card centered. |
| **Admin dashboard wrapper** | `frontend/cruip-landing/app/admin/layout.tsx` | Forces dark theme via `.appwrap` region; no page-level italic. |
| **Primitives** | `frontend/cruip-landing/components/ui/*.tsx` | Refactored shadcn/ui components. |
| **Nothing composites** | `frontend/cruip-landing/components/nothing-ui/` | New components unique to this project (e.g., segmented storage bar, metric tile). |
| **Docs theme** | `frontend/cruip-landing/theme.config.jsx` + `pages/docs/_meta.js` | Nextra theme overrides for monochrome + dot field. |
| **Stories / tests** | `frontend/cruip-landing/components/ui/__tests__/*.test.tsx` | Visual/story tests for primitives. |

### 7.4 Engineering agent handoff target

The next engineering agent should receive a package containing:

1. **Frozen tokens** — `nothing-tokens.css` with no TODOs.
2. **Component specs** — one spec file per primitive, following the component-spec template.
3. **Page inventory** — a table listing every route in `docs/site-map.md`, the components it uses, the assigned theme wrapper, and migration status.
4. **Visual reference** — a local copy of the `index.html` from `vibe-nothing-ui-design` or screenshots of its key modules.
5. **Build/test commands:**
   ```bash
   cd frontend/cruip-landing
   npm run build
   npm run lint
   ```
6. **Definition of done** — the acceptance criteria in §7.6 and the pre-ship checklist in §7.5.

### 7.5 Pre-ship checklist

- [ ] **Tokens only** — zero raw hex, arbitrary px radii, or ad-hoc font names in TSX/CSS.
- [ ] **Accent discipline** — ≤2 red elements per screen; every red element is a genuine signal.
- [ ] **Inversion for active states** — primary buttons, switches ON, selected chips/tabs/pagination/calendar-today, stepper current, progress fills all use `display` on `bg`.
- [ ] **Typography boundaries** — functional UI is Geist/Geist Mono sans-serif; Newsreader Italic appears only in page-level marketing copy.
- [ ] **Dot display numerals** — every standalone number and its `%` sign uses `--font-display` (Doto).
- [ ] **No shadows, no gradients** — no `box-shadow`, no `background-image` gradients, no shimmer/gradient animations.
- [ ] **Card recipe correct** — glass fill (`--glass`), 8px radius (`--r-md`), borderless, hover `translateY(-2px)`.
- [ ] **Dot field correct** — `~1.3px` dots at `~120px` spacing, `mix-blend-mode: difference`, `z-index: -1`, covered by cards.
- [ ] **Dot icons correct** — 9×9 grid of complete circles (`border-radius: 50%`), no masks or clip-path.
- [ ] **Both themes verified** — light and dark modes render correctly; admin dashboard stays dark.
- [ ] **Motion discipline** — `ease-in-out` only; ~200ms controls, ~350ms theme transitions.
- [ ] **Font licensing clean** — only SIL OFL fonts committed; no proprietary Nothing fonts.
- [ ] **Accessibility** — focus rings visible, color contrast ≥4.5:1 for body text.
- [ ] **No placeholder dead-ends** — every link/button navigates to a real route or is removed.

### 7.6 Acceptance criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | `npm run build` and `npm run lint` pass with zero errors in `frontend/cruip-landing`. | CI log |
| 2 | Every route listed in `docs/site-map.md` renders without 500/404 errors in both `data-theme="dark"` and `"light"` (admin routes in dark only). | Manual / Playwright smoke run |
| 3 | No raw hex codes, px radii, or font names exist in `app/**/*.tsx` or `components/**/*.tsx` outside of token definitions. | `grep -R` audit |
| 4 | `box-shadow` and `bg-gradient` utilities are absent from all redesigned components and pages. | `grep -R` audit |
| 5 | All interactive primitives implement the Nothing state machine and active-state inversion defined in Section 3. | Storybook or inline visual test |
| 6 | The dot field is visible in the gaps between cards/sections and invisible on card faces across the marketing landing, download catalog, and auth pages. | Screenshot comparison |
| 7 | Admin dashboard (`/admin/*`) renders in dark mode even when the global theme is light; no light-mode bleed. | Browser toggle test |
| 8 | Standalone numerals (storage quotas, user counts, percentages, page indices) render in Doto; labels render in Geist Mono uppercase. | Visual inspection + devtools check |
| 9 | Accent red (`#D71921` or `--accent`) appears only in signal contexts; a sample audit of 10 screens finds ≤2 red elements per screen. | Design review checklist |
| 10 | Lighthouse Performance ≥70, Accessibility ≥90 on the marketing landing and `/download`. | Lighthouse CI |
| 11 | All `href="#0"` and `href="#"` placeholders in production paths are replaced with real routes or removed. | `grep -R` audit |
| 12 | The pre-ship checklist in §7.5 is completed and signed off by both the implementing engineer and a reviewer. | Checklist file in PR |

**Final test:** place each redesigned screen side-by-side with the reference `index.html` from `vibe-nothing-ui-design`. If an unbiased viewer can identify which one is not from the Nothing UI kit, the screen is not yet shipped.
