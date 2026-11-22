# Development status

_Last updated: 2026-11-22_

## Summary

All six planned phases have a working first implementation. The app builds, passes type checks, passes 17 unit tests, and passes an end-to-end browser check: onboarding, quick add, persistence across reload, autosave, project templates, notes, search, the AI assistant against a mock local model, backup download, theme persistence and the mobile layout. It also loads fully offline after the first visit.

## Completed

### Phase 1 — Foundation
- [x] Vite + React + TypeScript + Tailwind project
- [x] Design system: warm cream/sage light theme and a separately tuned dark theme (CSS tokens in `src/index.css`), 6 accent colours, Inter + Newsreader fonts bundled locally (they work offline)
- [x] App shell: integrated glass top navigation, workspace selector, contextual sub-navigation, floating quick add, mobile bottom bar (the sidebar was removed in the design-system pass)
- [x] Local database (Dexie/IndexedDB), schema v1, with migration pattern documented
- [x] Autosave (debounced, flushed on tab hide/close) with a "Saved" indicator
- [x] JSON export (with files and no API keys), validated import (merge/replace), CSV exports, restore points (daily + before import), Trash with restore and permanent delete, erase-all with typed confirmation
- [x] Persistent-storage request; storage usage shown
- [x] Onboarding with optional, clearly labelled demo content (removable in one click)

### Phase 2 — Core productivity
- [x] Dashboard with 13 widgets: add, remove, drag to reorder, resize (S/M/L/full), reset; layout saved
- [x] My Day: plan, rule-based suggestions, schedule, completed today, daily notes
- [x] Tasks: all requested fields, subtasks, checklist, dependencies (blocked indicator), recurrence (next occurrence created on completion), list and board (by status or priority) with drag-and-drop, smart views, filters, sorting, bulk actions
- [x] Projects: cards/list, detail page (objectives, milestones, tasks, notes/docs, files, links, activity), templates (5 built-in plus custom), save project as template, transparent progress
- [x] Calendar: month/week/day, every item type colour-coded and filterable, create/edit events, drag to reschedule (events, tasks, content)
- [x] Ideas inbox: capture, optional user-chosen category, convert to task/project/content idea/note/campaign, archive

### Phase 3 — Professional workspaces
- [x] Campaigns: detail page with objectives, audience, key messages, activities, budget, linked project, press releases, coverage, content, tasks, results charts, brief generator
- [x] Press release tracker with Markdown drafting, statuses, dates, platform, links, results, files
- [x] Coverage log with reach and sentiment
- [x] Content Studio: calendar (drag to schedule), pipeline board, list with engagement rate, idea bank (convert to draft), social analytics (manual snapshots, trends, top posts)
- [x] Notes: Markdown editor (toolbar, split preview, list continuation, pasted/dropped images stored locally, interactive checklists), `[[wiki links]]` with backlinks, folders, categories, tags, linking to any item, attachments
- [x] Documents: outlines for 8 document types, focus mode, word count, export to PDF (print), Word (.doc), Markdown, HTML, text
- [x] Library: unified view of notes, documents, links and files, with folders, categories, tags and collections

### Phase 4 — Performance
- [x] Analytics: month-over-month stats, task throughput, status breakdowns, project progress, content per platform, coverage, campaign performance table
- [x] Custom KPIs: name, description, unit, target, period, direction, history (editable), trend vs previous value, target line
- [x] Monthly reviews: auto-gathered tasks, projects, content, campaigns, KPIs, outstanding work and achievements; reflections with rating; past months; Markdown export
- [x] Dashboard customisation

### Phase 5 — Intelligence
- [x] Provider-independent adapter (`src/lib/ai.ts`): Ollama and any OpenAI-compatible API (LM Studio, Groq, OpenRouter, Google AI Studio presets), streaming, clear error hints
- [x] Assistant: saved chats, quick actions (priorities, project summary, plan from rough thoughts, LinkedIn post, press release, campaign analysis, document summary, connections, monthly review, document draft)
- [x] Explicit context only: pick items or summaries, preview exactly what's sent, plus suggested related items while typing (context-aware search). Nothing is added without a click
- [x] Output actions need confirmation: save as note/document, create tasks (reviewed first)
- [x] No-AI mode with rule-based insights

### Phase 6 — Refinement
- [x] PWA: manifest, icons, service worker precaching, update prompt, verified offline
- [x] Responsive layouts and mobile navigation
- [x] Accessibility basics: semantic roles, labels on icon buttons, focus rings, keyboard shortcuts, reduced-motion support
- [x] Error boundaries per screen and per dashboard widget
- [x] Code-split routes
- [x] Unit tests (`src/test/core.test.ts`) and an E2E smoke script (`scripts/e2e-smoke.cjs`)
- [x] README, this file, CLAUDE.md

## Design system (Nov 2026)
- [x] `DESIGN.md`: the permanent visual/UX specification (typography, colour, spacing, radius, components, glass and elevation, layout, navigation, workspace composition, motion, data visualisation, icons, accessibility, governance, visual audit)
- [x] Tokens: `src/styles/tokens.css` (primitives), `themes.css` (Daylight + Dusk semantic roles, accent variants), `globals.css` (base, surfaces, type roles, prose, charts); Tailwind reads tokens only, and its default type/radius/shadow scales were removed
- [x] Fonts: Manrope (interface), Instrument Serif (editorial), IBM Plex Mono (technical), all bundled locally
- [x] Applied across every screen:
  - 501 font sizes, 134 radii and 30 shadows migrated to tokens
  - hard-coded chart, platform and tag colours moved to roles
  - top navigation replaces the sidebar
  - full-width canvas
  - home sections as floating workspaces
  - `Panel` and `ProjectPreview` components
- [x] Fixed: SVG colours given through CSS variables never rendered (progress rings, momentum chart); they now resolve through `src/lib/tokens.ts`

## In progress / next up
- Nothing is mid-way. Suggested next steps, in priority order:
  1. Run on real data for a week and refine anything that feels slow or clunky
  2. Recompose Content Studio, Library and Analytics per DESIGN.md §10 (they use the system's tokens and components but keep conventional layouts)
  3. Replace the remaining `window.prompt` dialog (rename library folder) with a styled modal
  4. Custom social metric fields in snapshots (the data model has `custom`, but there's no UI yet)
  5. Optional per-task time estimates and a weekly planning view

## Known issues and limitations
- **No cross-device sync.** Data is per browser. Use backup files to move data.
- **Statuses are fixed** (not user-customisable) to keep progress, analytics and reviews reliable. Custom fields and tags cover extra needs.
- **PDF export** uses the browser's print dialog ("Save as PDF").
- **Word export** is HTML saved as `.doc`. Word opens it fine but may show a format notice the first time.
- **The AI can't read PDFs or Word files.** It can read notes, documents and plain-text/Markdown/CSV files.
- **Browser notifications** only fire while the app is open. True background push would need a server.
- **Restore points don't include file contents** (to save space). Full backups do.
- **Library link titles** aren't fetched automatically. Pages can't be fetched from the browser without a server/CORS.
- **Dashboard drag-and-drop** uses native HTML drag events, which is limited on touch devices. Use the size and remove controls; reordering is easiest on desktop.
- The Recharts bundle (~110 KB gzipped) loads with the dashboard. It's acceptable, but it could be trimmed later.

## Remaining phases
None of the six planned phases remain. Possible future phases (only if wanted):
- **Optional sync**: e.g. self-hosted PocketBase or a free-tier database, with authentication and encryption. Needs an explicit decision about security and privacy.
- **Google Calendar two-way sync**: needs a Google Cloud OAuth client (free).
- **Custom statuses**: would need status mapping for analytics.

## Architectural decisions
| Decision | Why |
|---|---|
| Local-first IndexedDB (Dexie), no backend | ¥0 running cost, offline by default, private by default |
| Soft delete (`deletedAt`) on every record + Trash | Recover from accidental deletion |
| `isDemo` flag on sample records | Demo data is clearly labelled and removable without touching real data |
| Daily restore points in IndexedDB (last 10, without file blobs) | A safety net without filling storage |
| Notifications derived from data, only dismissals stored | Never stale, never piles up |
| Project progress = completed top-level tasks share, averaged 50/50 with milestones when both exist | Explainable, and many small tasks can't inflate it |
| AI via adapter interface, provider chosen at runtime, keys only in local DB and excluded from backups | Provider independence; no secrets in source or exports |
| AI context is opt-in per item with a preview | You control exactly what leaves the device |
| Markdown as the storage format for notes and documents | Portable, future-proof, exportable |
| Static hosting with SPA fallback (`public/_redirects`) | Works on Cloudflare Pages and other free hosts |
| Fonts bundled via @fontsource | No Google Fonts request at runtime, so it works offline and leaks nothing |
