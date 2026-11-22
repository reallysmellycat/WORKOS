# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner, a Mediabound team member who runs recruiting, staffing-agency relationships and PR/media outreach (including for the Daruma Jeans workshop in Harajuku), alongside their own planning.

They use it mainly at a desk on a laptop through the working day. A phone is secondary, used for quick capture and checking the day. No teammates, shared workspaces or other audiences.

## Product Purpose

Work OS is a private "professional headquarters". It brings into one connected place the work the owner would otherwise spread across email, calendar, spreadsheets and several apps: tasks, projects, campaigns, content, notes, documents, ideas, calendar, KPIs and monthly reviews.

Success means the owner opens it every morning, sees what matters today, and can trace how ideas became projects, tasks, campaigns, content and results, without paying for or depending on outside services.

## Positioning

- **Local-first and private:** all data lives in the owner's own browser. There is no account, server or tracking.
- **Free to run:** the running cost is ¥0.
- **Connected:** everything links together (idea → project → tasks → campaign → coverage/content → metrics → monthly review), shaped around one person's PR, recruiting and agency work rather than a team's.

## Operating Context

The core jobs, all four in scope:
1. **Recruiting and interviews:** many candidate interviews, interview rounds, invitations and follow-ups. A shared candidate pipeline spreadsheet already exists in Google Drive.
2. **Staffing-agency and vendor relationships:** introductions, meetings, quotes, contracts.
3. **PR and media outreach:** pitches to media outlets, press materials, coverage tracking, social content.
4. **Personal planning:** tasks, projects, notes, documents, monthly reviews.

The owner's real working tools are Gmail, Google Calendar and Google Drive. Much of their correspondence is in Japanese, so content must display Japanese text well. A separate local productivity dashboard (`productivity/dashboard.html`, backed by `productivity/TASKS.md`) also exists in this repo.

## Capabilities and Constraints

- **Built:**
  - Tasks with subtasks, dependencies and recurrence; projects with templates and an explained progress calculation.
  - PR campaigns, press releases and a coverage log; Content Studio with manually entered social metrics.
  - Notes with wiki links; documents with export; library; ideas inbox; calendar.
  - Analytics with custom KPIs; monthly reviews; global search and quick add; notifications.
  - Trash, restore points, and JSON/CSV backup and import; installable app (PWA) that works offline; optional AI assistant.
- **Stack:** existing React + TypeScript + Vite + Tailwind, with Dexie/IndexedDB storage. See `README.md` and `CLAUDE.md`.
- **Hard constraints:**
  - ¥0 running cost.
  - No paid services, and no API key required for core features.
  - Data stays on the device, with no automatic sync.
  - Never silently overwrite or delete data.
  - AI may only suggest and draft; every write needs the owner's confirmation.
  - Demo data must always be labelled.
- **Interface language:** English only. Content in Japanese must render correctly.
- **Open decisions:**
  - Recruiting is a core job, but there is no candidate/interview pipeline feature yet. Whether to build one, or link to the existing Google Sheet, is undecided.
  - Agency/vendor contacts have no dedicated contact or CRM feature yet.
  - Cross-device sync is deliberately not built.

## Brand Commitments

The product name is "Work OS". No logo, mascot or external brand guidelines exist. Its voice is calm, plain and direct, written for a non-engineer.

## Evidence on Hand

None. There are no real testimonials, users, metrics or press about Work OS itself. The only sample content is clearly labelled demo data (`src/lib/demo.ts`). No claims about usage or performance may be invented.

## Product Principles

1. **The owner's data is theirs.** It stays local, is exportable, recoverable and never silently changed.
2. **One connected place beats many apps.** Every item should link to the work it came from and the results it led to.
3. **Today first.** Opening the app should answer "what matters now?" before anything else.
4. **Honest numbers only.** Metrics come from what the owner recorded, never estimated or fabricated.
5. **Free and independent.** No feature may require payment or a third-party account to work.

## Accessibility & Inclusion

No specific requirement has been stated beyond sensible defaults: keyboard access, visible focus, reduced-motion support, and readable contrast in light and dark themes.
