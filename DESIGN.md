# WorkOS Design System

> **This file is the source of truth for every interface in WorkOS.** New screens, components and features follow it. If something new genuinely needs a value that does not exist, add a token to `src/styles/tokens.css` (and `themes.css` if it is a colour role), document it here in the same change, and never hard-code it in a component.

**Identity:** *Dark Intelligence × Creative Operating System × Spatial Interface.* "Dark intelligence" describes how sophisticated and composed the interface is. It does **not** mean a dark colour scheme. WorkOS is a private intelligence environment: architectural, layered and precise. Its warm neutral environment carries translucent floating workspaces, editorial type and quiet data.

**The signature element** is the translucent architectural workspace: floating panels over a softly lit environment. Inside those panels sit editorial typography and analytical clarity.

---

## 0. Where things live

| File | Role |
|---|---|
| `DESIGN.md` | Specification: rules, rationale, usage |
| `src/styles/tokens.css` | **Primitives**: palette, type scale, spacing, radius, elevation, motion, layout, icon sizes |
| `src/styles/themes.css` | **Semantic roles** (`--bg`, `--surface`, `--fg`, `--accent`…) mapped to primitives for Daylight and Dusk, plus accent variants |
| `src/styles/globals.css` | Base styles, surface classes (`.panel`, `.workspace`, `.elevated`, `.glass`, `.ink-panel`), type roles (`.display`, `.eyebrow`, `.meta`, `.num`), fields, prose, charts, print, reduced motion |
| `tailwind.config.js` | Utilities that **read** the tokens. No raw values live here |
| `src/lib/tokens.ts` | Bridge for places that can't read CSS variables (SVG chart attributes, `<meta theme-color>`). It reads live tokens and duplicates nothing |
| `src/components/ui.tsx` | Button, IconButton, Input, Textarea, Select, Field, Checkbox, Toggle, Badge, Tag, Progress, Ring, Empty, Loading, Modal, Drawer, Menu (popover), Tabs, PageHeader, Page, Section, **Panel**, Card, Stat, Kbd, SavedIndicator |
| `src/app/TopNav.tsx` | Top navigation, workspace selector, contextual sub-navigation |
| `src/components/ProjectPreview.tsx` | Project preview |
| `src/features/tasks/TaskRow.tsx` | Task item |
| `src/components/charts.tsx` | Bars, Lines, Sparkline, StatusBar, all token-coloured |
| `src/components/Cover.tsx` | Generative cover art (illustration palette, see §3.6) |

Layering rule: **components use semantic roles → roles point at primitives → primitives hold values.** A component never uses a hex value, a pixel font size or an ad-hoc radius.

---

## 1. Design philosophy

**Characteristics:** immersive, architectural, sophisticated, spatial, intelligent, creative, precise, layered, atmospheric, editorial, minimal but expressive.

**How the two references are interpreted:**
- **Reference 1, editorial analytics:**
  - serif statements over numbers
  - quiet gridlines
  - tabular figures
  - precise mono labels
  - generous but purposeful proportion
- **Reference 2, spatial workspace:**
  - a lit environment
  - floating translucent panels
  - fine light edges
  - layered depth
  - an integrated top bar instead of an admin sidebar

**What WorkOS is not:** a white SaaS dashboard, a black dark-mode app, a grid of identical cards, a gradient showcase.

**Principles**
1. **One environment, many workspaces.** The canvas is continuous; each workspace re-composes it (§10).
2. **Depth carries hierarchy.** Use the environment, floating panels and elevated overlays (§7) before reaching for colour or weight.
3. **Type does the expressive work.** Manrope dominates, Instrument Serif brings personality, IBM Plex Mono brings precision (§2).
4. **Colour is a signal, not decoration.** Neutrals carry the interface. Sage marks interaction. Other accents appear only with a reason (§3).
5. **Real data only.** Every chart and number is computed from stored records (§12).

---

## 2. Typography

### 2.1 Families

| Family | Token | Weights | Role | Share |
|---|---|---|---|---|
| **Manrope** (variable) | `--font-sans` · `font-sans` | 400 body · 500 medium · 600 semibold · 700 bold | Navigation, body, buttons, inputs, labels, components | Dominant (~85%) |
| **Instrument Serif** | `--font-serif` · `font-serif` / `.display` | 400, 400 italic | Page titles, editorial statements, section introductions, key dashboard headings | Personality (≤1–3 uses per screen) |
| **IBM Plex Mono** | `--font-mono` · `font-mono` / `.meta` `.num` `.eyebrow` | 400, 500 | Dates, times, metadata, KPI values, numeric indicators, status codes, technical labels | Precision |

All three are bundled locally (`@fontsource`), so they work offline and nothing is requested from Google at runtime.

### 2.2 Scale

Desktop reference sizes. Display and H1–H2 scale fluidly with `clamp()` on smaller screens.

| Token | Size | Tailwind | Line height | Typical use |
|---|---|---|---|---|
| Display XL | 64px | `text-display-xl` | 1.02 | Home greeting / hero |
| Display L | 48px | `text-display-l` | 1.02 | Workspace (page) titles |
| H1 | 36px | `text-h1` | 1.15 | Major statements, metric values, project titles in features |
| H2 | 28px | `text-h2` | 1.15 | Section titles (serif) |
| H3 | 22px | `text-h3` | 1.15 | Subsections, dialog titles |
| H4 | 18px | `text-h4` | 1.3 | Component headings |
| Body L | 16px | `text-body-l` | 1.55 | Primary reading text |
| Body M | 14px | `text-body-m` | 1.55 | Standard interface text (body default) |
| Body S | 13px | `text-body-s` | 1.55 | Lists, controls, supporting text |
| Caption | 11px | `text-caption` | 1.3 | Metadata |
| Micro | 10px | `text-micro` | 1.3 | Compact uppercase labels |

Tailwind's default font-size scale is **removed**: only these names exist, so drift fails the build.

### 2.3 Roles (classes in globals.css)

- `.display`: Instrument Serif, tracking −0.02em, tight leading. Pair with a size token.
- `.eyebrow`: Plex Mono, 10px, uppercase, +0.08em. The workspace label above a title.
- `.meta`: Plex Mono, 11px. Dates, times, counts.
- `.num`: Plex Mono 500, tabular figures. KPI values and metrics.
- `.label`: form labels (mono micro uppercase).

### 2.4 Rules

- Use **one serif moment per region** (title or statement), never serif body text.
- Use whitespace, not size, to make headings important. Don't stack Display sizes.
- Prefer weight 600 for emphasis; reserve 700 for the wordmark and rare emphasis.
- Uppercase belongs to technical metadata only (eyebrows, labels, column heads).
- Every metric uses tabular numerals (`.num`, `.meta`, `tabular-nums`).
- Italic serif is reserved for a single word of personality (e.g. the greeting's name).

---

## 3. Colour

### 3.1 Core palette

| Token (tokens.css) | Hex | Purpose |
|---|---|---|
| `--color-bg-primary` | #D8D5CE | Main environment |
| `--color-bg-secondary` | #C9C5BC | Secondary environment |
| `--color-surface-primary` | #E7E3DA | Floating surfaces |
| `--color-surface-elevated` | #F0EDE6 | Elevated content |
| `--color-surface-muted` | #BDB8AE | Supporting surfaces, wells, tracks |
| `--color-graphite` | #292B29 | Primary typography |
| `--color-graphite-soft` | #555750 | Secondary typography |
| `--color-text-muted` | #85847C | Supporting text |
| `--color-border-subtle` | #FFFFFF @ 44% | Soft light edge of surfaces |
| `--color-border-strong` | #88877E @ 33% | Defined boundaries, dividers |

### 3.2 Accents

| Token | Hex | Purpose |
|---|---|---|
| `--color-accent-primary` | #829488 | Sage: key interactions, focus, progress |
| `--color-accent-secondary` | #A4B3A5 | Soft sage tints |
| `--color-accent-deep` | #596D60 | Emphasis, accent **text** |
| `--color-accent-teal` | #65B9A9 | Live / selected indicators |
| `--color-accent-violet` | #A66BE8 | Creative visualisation, sparingly |
| `--color-accent-warm` | #D69A77 | Warm emphasis (now-marker, notification count) |

### 3.3 Semantic

| Token | Hex | Purpose | Text-safe "ink" |
|---|---|---|---|
| `--color-success` | #65A88A | Completed | #386E54 |
| `--color-warning` | #D6A15F | Attention | #845C24 |
| `--color-error` | #C87570 | Errors, overdue | #9A4641 |
| `--color-info` | #779BAE | Informational | #426274 |

The semantic hues are too light to be readable as small text on the warm surfaces. When a semantic colour **is the text** (labels such as "2d overdue"), the derived ink shade is used. The `text-danger` / `text-warn` / `text-ok` / `text-info` utilities already point to it. Raw hues are for dots, fills and chart marks.

### 3.4 Semantic roles (themes.css) used by components

| Role | Tailwind | Daylight → primitive |
|---|---|---|
| Environment | `bg-bg` / `bg-desk` | bg-primary / bg-secondary |
| Floating surface | `bg-surface` | surface-primary |
| Elevated surface | `bg-raised` | surface-elevated |
| Well / track / hover | `bg-sunken` | surface-muted (used at 30–60% alpha) |
| Divider | `border-line` | border-strong |
| Light edge | `ring-edge` / `border-edge` | border-subtle |
| Text | `text-fg` / `text-muted` / `text-faint` | graphite / graphite-soft / text-muted |
| Accent fill | `bg-accent` | accent-primary |
| Accent text | `text-accent-deep` | accent-deep |
| Inverse panel | `bg-ink text-ink-fg` | graphite / surface-elevated |
| Alert text on the inverse panel | `text-ink-alert` | accent-warm (Dusk: error ink, because the panel is light there) |
| Supporting accents | `teal`, `violet`, `clay` (warm), `ochre` | accents |
| Semantic text | `ok`, `warn`, `danger`, `info` | semantic inks |

### 3.5 Themes

- **Daylight** (default): warm architectural neutrals with graphite type.
- **Dusk**: smoked graphite surfaces (#2E2F2C environment, #383934 panels), soft cream type, lifted sage. It is deep, but **never black**. It is fully specified in `themes.css`, not an inversion of Daylight.
- **Accent variant** (Settings → Appearance): Sage (default), Deep sage, Teal, Warm, Violet or Graphite. Each one remaps only the accent roles.

### 3.6 Illustration palette (exception)

Generative project/campaign covers (`Cover.tsx`) draw from a fixed seven-swatch illustration palette (sage, clay, ochre, slate, plum, ink, sand). They are artwork, not interface chrome, so they live with the component. They must stay muted and never appear as UI fills.

### 3.7 Application rules

- Graphite for type; warm neutrals for space; translucency for floating surfaces.
- Sage marks the interactive and the selected. Teal is only for "live" or "selected now". Violet only appears in visualisations with 5+ series. Warm is only for time-now and attention counts.
- **Never use all accents at once.** Two accent hues per view is the practical ceiling.
- No decorative gradients. The only gradients are the environment's soft light field and chart area fades.

---

## 4. Spacing

A 4px base. Tailwind's numeric spacing **is** this scale (`p-4` = `--space-4` = 16px).

| Token | Value | Tailwind | Use |
|---|---|---|---|
| space-0 | 0 | `0` | none |
| space-1 | 4px | `1` | icon–label gaps, micro |
| space-2 | 8px | `2` | tight groups |
| space-3 | 12px | `3` | compact padding |
| space-4 | 16px | `4` | standard padding |
| space-5 | 20px | `5` | component padding |
| space-6 | 24px | `6` | panel padding, grid gap |
| space-8 | 32px | `8` | large component spacing |
| space-10 | 40px | `10` | major separation |
| space-12 | 48px | `12` | section separation |
| space-16 | 64px | `16` | large layout separation |
| space-20 | 80px | `20` | page-level spacing |
| space-24 | 96px | `24` | hero / page bottom (clears the floating action) |

Half steps (`0.5`, `1.5`, `2.5`, `3.5`) are allowed only for optical alignment *inside* a component (e.g. icon nudges).

**Layout tokens:**
- `--page-gutter`: 16 / 24 / 40 / 64px by breakpoint (`px-gutter`)
- `--grid-gap`: 24px (`gap-grid`)
- `--grid-gap-compact`: 16px (`gap-grid-compact`)
- `--section-gap`: 56px (`gap-section`)
- `--nav-height`: 68px (`pt-nav`)

**Principles:**
- Related elements sit close; unrelated sections get 40–64px.
- Panels use 20–28px of padding.
- Lists use 8–12px row padding.
- Never cramp to fit; let a region scroll instead.

---

## 5. Radius

| Token | Value | Tailwind | Use |
|---|---|---|---|
| radius-none | 0 | `rounded-none` | structural edges |
| radius-xs | 4px | `rounded-xs` | indicators, kbd, code |
| radius-sm | 8px | `rounded-sm` / `rounded` | compact controls, list rows, menu items |
| radius-md | 12px | `rounded-md` | **buttons, inputs**, small panels |
| radius-lg | 16px | `rounded-lg` | standard panels, cards, menus |
| radius-xl | 22px | `rounded-xl` | large workspace surfaces, dialogs, top bar |
| radius-2xl | 28px | `rounded-2xl` | immersive panels |
| radius-3xl | 36px | `rounded-3xl` | hero containers |
| radius-full | 9999px | `rounded-full` | pills, avatars, icon buttons, toggles |

Rules:
- Nested radius = outer radius − padding (roughly): a 22px workspace holds 12–16px items.
- Never give every element the same radius.
- Tailwind's default radius scale is replaced by these names.

---

## 6. Components

All component styling is in `ui.tsx` / globals.css. Reuse these before writing new markup.

### Buttons (`<Button>`)

| Variant | Look | Use |
|---|---|---|
| `primary` | Graphite fill, cream text, `shadow-sm`, lifts 1px on hover | The one main action in a view |
| `secondary` | Translucent elevated fill, hairline, `shadow-xs` | Default action |
| `ghost` | No fill; well tint on hover | Tertiary, toolbar actions |
| `subtle` | Well tint | Toggled / filter state |
| `danger` | Error fill | Destructive confirmations only |

- **Sizes:** `xs` 24px (8px radius), `sm` 32px (12px), `md` 36px (12px).
- **Text:** Manrope 600, `text-body-s`; icons 15px at stroke 1.9.
- **Transitions:** `duration-fast ease-out`; press scales to 0.98.
- **Icon buttons** (`<IconButton>`): circular, 36px (`md`) or 28px (`sm`), 18px or 14px icon, well tint on hover, `active` state for toggles. Always pass `label` (it becomes `aria-label` and the tooltip).

### Inputs (`.field`, `<Input>`, `<Textarea>`, `<Select>`)

A translucent elevated fill, a hairline inner border (border-strong), a 12px radius and 7×12px padding in `text-body-s`. Focus shows a sage inner ring plus a 3px soft sage halo. Labels use `.label` (mono micro uppercase) through `<Field label>`. No heavy outlined boxes.

### Surfaces (three levels)

| Level | Class / component | Treatment | Use |
|---|---|---|---|
| 1 Environment | `body` | `--bg` plus a soft architectural light field (fixed radial gradients) | The canvas everything floats on |
| 2 Floating | `.panel` / `<Panel>` / `<Card>` | surface fill, white light edge, top highlight, `shadow-sm`, 16px radius | Work panels |
| 2 Workspace | `.workspace` / `<Panel variant="workspace">` | translucent surface + blur 18px, `shadow-md`, 22px radius | Large regions (home sections, big composites) |
| 2 Glass | `.glass` / `<Panel variant="glass">` | elevated fill at 62% + blur 18px, opaque fallback | Top bar, bottom bar, overlays on content |
| 3 Elevated | `.elevated` / `<Panel variant="elevated">` | elevated fill, hairline, `shadow-lg` (dialogs `shadow-xl`) | Menus, popovers, dialogs, drawers, workspace selector |
| Inverse | `.ink-panel` / `<Panel variant="ink">` | graphite with grain, 22px radius | The single most important block on a screen (e.g. Today's focus) |

### Cards

Cards (`<Card>`) group things when the grouping helps. Prefer `<Section>` (a title with a hairline rule) for plain grouping. Vary scale: a feature item may span 7 of 12 columns while its siblings take 5.

### Specialised components

- **Project preview** (`ProjectPreview`): a cover, a status badge on the cover, the title (serif when it is the feature), and a Next / Open tasks / Deadline mono grid with progress. It has a `feature` size for the lead item.
- **Task item** (`TaskRow`):
  - a circular checkbox that pops, draws its check and strikes the title on completion
  - the priority colour on the ring
  - due text in a semantic ink
  - compact icons for recurrence, subtasks and blocked state
- **Badge**: a dot and label on a translucent pill with a hairline. Tone colours the dot and text, never the fill.
- **Tag**: a dot, a name and a well-tinted pill.
- **Progress**: a 4px track in the well colour, with a sage fill that grows in.
- **Ring**: the track uses the well colour; the arc is accent-deep.
- **Empty state**: a dashed ring around an icon, a serif title in H2, one sentence and one action.
- **Tabs**: text tabs with a sliding 2px graphite underline.
- **Sub-navigation**: a pill group with a sliding raised pill.
- **Modal**: elevated surface, 22px radius, `shadow-xl`, a scale-in entrance and a blurred environment behind it.
- **Drawer**: elevated surface, floats 12px from the edges on desktop and is full-bleed on mobile.
- **Menu / popover**: elevated surface, 16px radius, 8px item radius, scale-in from its origin.

---

## 7. Glass and depth

- **Glass:** `backdrop-filter: blur(var(--glass-blur) = 18px) saturate(140%)` over a fill at ~60% opacity, a fine white edge at 44% and a 1px top highlight (`--highlight-edge`).
- **Fallback:** `@supports` falls back to a 96%-opaque fill where `backdrop-filter` is unavailable.
- **Where it's used:** only where content passes beneath it or where it separates a floating layer from a busy background: the top bar, mobile bar, home workspaces and modal backdrops.
- **Readability:** text on glass always uses `fg` or `muted`, never `faint`.

### Elevation tokens

| Token | Use |
|---|---|
| `shadow-xs` | Control separation (secondary buttons, tags) |
| `shadow-sm` | Floating panels, raised pills |
| `shadow-md` | Workspaces, hovered panels |
| `shadow-lg` | Menus, popovers, ink panel, floating action |
| `shadow-xl` | Dialogs, drawers, immersive overlays |

Shadows are warm (`--color-shadow` 58 52 42), broad and low-opacity, never black or hard.

---

## 8. Layout

**No permanent left sidebar.** The application is one expansive canvas under an integrated top navigation.

| | Desktop ≥1440 | Laptop 900–1439 | Tablet 640–899 | Mobile <640 |
|---|---|---|---|---|
| Page gutter | 64px | 40px | 24px | 16px |
| Top bar | Full: identity, 7 workspaces, search, AI, alerts, theme, profile | Same; below 1100px the workspace tabs collapse into the selector | Compact | Compact + floating bottom bar |
| Grid | 12 columns, gap 24 | 12 columns | adaptive (1–2) | single column |
| Quick add | Floating "New" button, bottom right | same | bottom bar | bottom bar centre |

- **Page container** (`<Page>`): full width with `px-gutter`, `pt-8/10` and `pb-24`. There is no max-width by default. `reading` applies `max-w-reading` (760px) for long-form text only (documents, notes).
- **Grid:** 12 columns with `gap-grid`. Compose asymmetrically (7/5, 8/4, 12) and let feature regions span rows. Don't force identical columns.
- **Sections:** separate unrelated sections by 40–64px.
- **Sticky elements:** sticky toolbars use `top-[var(--sticky-top)]`. The shell sets `--sticky-top` to the nav height.

---

## 9. Navigation

**Top bar** (`TopNav`): a glass bar inset 12–16px from the window edges, 56px tall, with a 22px radius.

1. **Identity + workspace selector:** the WorkOS mark, the name and the current workspace label. Clicking opens a floating panel with every destination grouped, keyboard shortcuts, the active-project switcher (cover swatch and progress), recently visited items, the theme switch and settings.
2. **Workspaces:** Home · Projects · Tasks · Calendar · Studio · Library · Insights. The active one sits on a raised pill that glides between items.
3. **Utilities:** search (⌘K), AI Assistant, notifications (warm count), Daylight/Dusk switch, and the profile/settings avatar.

**Contextual sub-navigation** (`SubNav`) appears under the bar only in workspaces with several pages:

| Workspace | Pages |
|---|---|
| Home | Command centre, My Day |
| Projects | Projects, Ideas inbox |
| Studio | Content Studio, PR & Campaigns |
| Library | Archive, Notes, Documents |
| Insights | Analytics, Monthly reviews |

The route → workspace map lives in `app/nav.ts` (`WORKSPACES`, `locate()`).

**Other ways to move:** the command palette (⌘K or `/`), `G` + letter shortcuts, `N` for quick add, the floating New button and the mobile bottom bar (Home, Tasks, New, Calendar, Projects).

Keep the top bar uncluttered: no new top-level items without removing one.

---

## 10. Workspace composition

Every workspace shares the shell, tokens and components, but composes the canvas differently.

| Workspace | Composition |
|---|---|
| **Home: command centre** | An open masthead on the environment (date eyebrow, Display-XL greeting with an italic name, the **day line** density strip), then floating workspaces: Focus (ink panel), Schedule timeline, Projects (feature + list), Field notes feed, Momentum chart; Ideas as an open index-card strip; Campaign timeline; Notes |
| **Projects** | An asymmetric preview grid: the lead project is a feature (7 cols × 2 rows), others 5 cols. The project page is a workspace with a cover header and property rail |
| **Tasks** | A focused execution list in one wide panel, grouped by urgency; a board view for flow |
| **Studio** | An editorial calendar, a pipeline with platform dots, the idea bank and manual social analytics |
| **Library** | A search-first archive: filter rail, collections and editorial cards |
| **Insights** | A narrative stat row, then charts with mono axes and serif statements |
| **Calendar** | Month/week/day with a coloured left rule per source |

---

## 11. Motion

| Token | Duration | Tailwind | Use |
|---|---|---|---|
| instant | 100ms | `duration-instant` | Press feedback |
| fast | 150ms | `duration-fast` | Hover, colour |
| normal | 220ms | `duration-normal` | Standard transitions, toggles, dialogs |
| smooth | 300ms | `duration-smooth` | Panels, indicators, task completion |
| deliberate | 450ms | `duration-deliberate` | Page / workspace transitions, progress growth |

**Easing:**
- `ease-out` (`cubic-bezier(.22,1,.36,1)`) for entrances
- `ease-in-out` for state changes
- `ease-spring` (slight overshoot) for toggles, check-pops and the floating action

**Defined motions** (`tailwind.config.js` animations):
- **page transitions:** `page`
- **panel / item entrance:** `in`
- **dialogs and menus:** `scale`
- **drawers:** `drawer`
- **checkbox:** `pop` + `draw`
- **completion strike-through:** `strike`
- **progress and timeline bars:** `grow`
- **gliding indicators:** CSS transitions on position
- **skeleton shimmer**

**Rules:**
- Animate `opacity` and `transform` only.
- No motion for decoration.
- `prefers-reduced-motion` collapses all durations to ~0 (globals.css).

---

## 12. Data visualisation

- **Library:** Recharts via `components/charts.tsx` (`Bars`, `Lines`, `Sparkline`, `StatusBar`). Don't style charts ad hoc.
- **Colours:** series colours come from `CHART_ROLES` in `lib/tokens.ts`, resolved from live tokens by `useChartColors()` so they follow the theme. The order is sage → teal → warm → info → violet → deep sage. Violet appears only from the 5th series. Platforms map to fixed roles (`colorFor`).
- **Gridlines:** horizontal only, at the divider colour, with no axis lines.
- **Labels and tooltips:** axis labels in Plex Mono 10px in the faint colour; legends in caption size. The tooltip is an elevated surface with a mono value.
- **Statements:** pair charts with a serif sentence that states the finding ("18 tasks done this month — 4 more than October").
- **Data integrity:** charts show only stored data. Never fabricate, interpolate or imply connected platform analytics. Label manual data as manual.

---

## 13. Iconography

Use Lucide only.

| Size | Value | Use |
|---|---|---|
| Compact | 14px | |
| Default | 18px | icon buttons |
| Inline with text | 15px | in buttons and tabs |
| Large | 22–24px | |

- **Stroke:** 1.7–1.9 (`--icon-stroke` 1.8).
- **Alignment:** icons sit on the text's optical centre.
- **Purpose:** icons support meaning; never use one as decoration, and don't mix icon sets.

---

## 14. Accessibility and usability

- **Contrast:**
  - Body text (graphite on surfaces): ≈11:1.
  - Muted text: ≈6:1.
  - Faint text (#85847C): ≈3.3:1 on surfaces. Use it only for non-essential metadata, never for instructions.
  - Accent text uses accent-deep; semantic text uses the ink shades (§3.3).
- **Focus:** every interactive element shows a 2px accent-deep outline at 2px offset (`:focus-visible`).
- **Keyboard:** the command palette, `G` shortcuts, Esc closes overlays, Enter submits quick add, and arrow keys work in the palette.
- **Semantics and labels:** use real `<button>`, `<nav>`, `<header>`, `<main>` and `role="dialog"`/`menu`/`tab`/`checkbox`/`switch`. Icon-only controls carry `aria-label`.
- **Touch targets:** 36px or larger on desktop, and 44px or larger for the primary mobile controls (bottom bar, quick add).
- **Motion:** reduced-motion is respected.
- **Glass readability:** glass never sits behind long text, and it has an opaque fallback.

---

## 15. Governance

When building or changing UI:
1. Compose from `ui.tsx`, `Panel`, `ProjectPreview`, `TaskRow`, `charts.tsx`, `TopNav` and `SubNav` first.
2. Use only token utilities:
   - **type:** `text-display-xl … text-micro`
   - **colours:** semantic roles
   - **spacing:** the 4px scale, `px-gutter`, `gap-grid`
   - **radius:** `rounded-xs … rounded-3xl`
   - **shadows:** `shadow-xs … shadow-xl`
   - **motion:** `duration-*` / `ease-*`
3. No hex, no `text-[13px]`, no arbitrary radius. If a value is missing, add a token: update `tokens.css` (and `themes.css` for colour roles) and this file in the same commit.
4. A new pattern needs a reason recorded here.
5. Check both themes, mobile width and reduced motion before shipping.

---

## 16. Visual audit of the pre-system interface (Nov 2026)

What was wrong before this system and what changed:

| Finding | Evidence | Resolution |
|---|---|---|
| Typography drifted | 30+ ad-hoc sizes (`text-[13px]` ×143, `text-[13.5px]` ×35, `text-[12.5px]`, `text-[10.5px]`…) on top of Tailwind's defaults | 11-step token scale; Tailwind defaults removed; 501 usages migrated |
| Radius had no logic | Five Tailwind radii plus arbitrary `rounded-[16px]`, `[9px]`, `[5px]`… | 9 radius tokens; 134 usages mapped by role |
| Hard-coded colours | Chart series, platform colours, KPI lines, tone bars, tag swatches and accent swatches as hex in components | All moved to roles; charts resolve live tokens; tags store role colours |
| SVG colours silently broken | `stroke="rgb(var(--accent))"` on SVG attributes (CSS variables don't resolve there) left the progress rings and the momentum chart uncoloured | Moved to `style` or resolved through `lib/tokens.ts` |
| Admin-shell layout | A permanent left sidebar plus a narrow centred column (5 different max-widths: 1180/1220/1320/1480/1000) | Top navigation, full-width canvas, reading width only for long-form |
| Flat depth | Every region was the same white-ish card with one shadow | Three surface levels, glass where content passes beneath, warm elevation scale |
| Accents everywhere | Sage used for text, fills, links, primary buttons and charts alike | Graphite primary actions; sage for interaction and state; deep sage for accent text |
| Weak semantic text contrast | Light semantic hues used as small text | Text-safe ink shades for semantic text |

Known remaining work:
- The Content Studio, Library and Analytics compositions use the system's components and tokens but still have conventional layouts. Recomposing them per §10 is the next design pass.
- A few deliberate one-off pixel values remain, for optical sizes such as a 15px inline icon or a 54px day-line strip.
