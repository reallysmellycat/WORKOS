# Work OS

A private, local-first operating system for your professional life: tasks, projects, PR campaigns, content, notes, documents, ideas, calendar, analytics and monthly reviews in one calm, connected app.

- **Free to run (¥0).** No database subscription, no hosting bill, no API key needed.
- **Private.** Your data stays in your browser on your device. There's no account, server or tracking.
- **Works offline.** Once it's loaded, install it as an app and it runs without a connection.
- **Yours.** Export everything to one backup file at any time, and restore it here or on another device.

---

## What it does

| Area | What you can do |
|---|---|
| **Dashboard** | Greeting and daily summary, plus 13 widgets you can add, remove, reorder and resize (priorities, deadlines, overdue, projects, events, campaigns, content, performance, notes, ideas, achievements, activity) |
| **My Day** | Plan today, see suggestions (from simple rules, not AI), your schedule, what you've completed, and daily notes |
| **Calendar** | Month, week and day views showing events, work blocks, reminders, task deadlines, milestones, content dates and campaign dates. Drag items to reschedule them |
| **Tasks** | Priorities, statuses, start/due dates, subtasks, checklists, dependencies, recurring tasks, tags, attachments, custom fields. List and board views with filters, sorting, bulk actions and drag-and-drop |
| **Projects** | A dedicated page for each project with objectives, milestones, tasks, notes, documents, files, links and activity. Create projects from templates or save your own. Progress is calculated transparently |
| **PR & Campaigns** | Campaign pages (objectives, audience, key messages, activities, budget), a press release tracker, a coverage log, and results charts |
| **Content Studio** | Content calendar, pipeline board, list, idea bank (hooks, concepts, captions…) and social analytics you record yourself |
| **Library / Notes / Documents** | Markdown notes with `[[wiki links]]`, backlinks, images, folders, categories, tags and collections. Documents come with outlines and export to PDF, Word, Markdown and HTML |
| **Ideas** | Fast capture. Convert any idea into a task, project, content idea, note or campaign |
| **Analytics & Monthly Reviews** | Real charts from your data, custom KPIs with targets and history, and a monthly review that gathers itself automatically. You add your own reflections |
| **AI Assistant** *(optional)* | Drafts posts, press releases and plans, summarises projects and suggests priorities, using a free local or free-tier model you choose. It sees only what you select |
| **Everywhere** | ⌘K search, quick add (press **N**), notifications, light/dark themes, accent colours, a Trash with restore, and automatic restore points |

---

## Run it on your computer

You need **Node.js** (free). Check whether you have it by opening Terminal and running `node -v`. If it isn't installed, download the "LTS" version from <https://nodejs.org>.

```bash
# 1. Get the code (skip if you already have the folder)
git clone https://github.com/reallysmellycat/WORKOS.git
cd WORKOS

# 2. Install the building blocks (one-time, takes a minute)
npm install

# 3. Start it
npm run dev
```

Then open the address it prints (usually <http://localhost:5173>).

- `npm run dev` starts a local version that refreshes as code changes.
- Stop it with **Ctrl + C** in Terminal.

## Build it

```bash
npm run build     # checks the code, then creates the finished app in the dist/ folder
npm run preview   # serves dist/ locally so you can try the finished app
npm test          # runs the automated tests
```

---

## Deploy it for free (Cloudflare Pages)

This puts Work OS on a private web address so you can install it on your laptop and phone. Hosting only delivers the app's code. **Your data still stays on each device.**

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. In the Cloudflare dashboard, open **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorise GitHub and pick the **WORKOS** repository.
4. Use these build settings:
   - **Framework preset:** `Vite` (or "None")
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**. After a minute you'll get an address like `https://work-os-xyz.pages.dev`.
6. Every time new code is pushed to the main branch, Cloudflare rebuilds automatically.

**Keeping it private (optional, free):** the app has no login, because your data is local and a stranger visiting the URL sees an empty workspace in *their* browser, not yours. If you'd still rather the URL isn't public, add **Cloudflare Access** (free for up to 50 users): in the dashboard go to **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**, enter your `pages.dev` address, and allow only your email.

> Free-tier limits: Cloudflare Pages' free plan includes 500 builds per month and unlimited visits, which is far more than one person needs. Other free static hosts (Netlify, GitHub Pages, Vercel) also work. Use the same build command and output folder.

### Install it as an app
- **Desktop (Chrome/Edge):** open the site and click the install icon in the address bar.
- **iPhone/iPad (Safari):** tap Share → **Add to Home Screen**.
- **Android (Chrome):** menu → **Install app**.

---

## How your data is stored

- Everything is saved automatically in your browser's built-in database (IndexedDB) on **this device and this browser only**.
- Refreshing, closing the tab or restarting the computer does **not** lose data.
- Data does **not** sync between devices or browsers automatically.
- Data **can** be lost if you clear your browser's site data, use a private/incognito window, or lose the device. Back up regularly.
- Work OS asks the browser to protect its storage from automatic clean-up. Installing it as an app makes this more likely to be granted. Settings → Data shows the status.
- Deleted items go to **Settings → Trash**, where you can restore them.
- A **restore point** (snapshot) is saved automatically once a day, plus before every import. The last 10 are kept.

## Back up and restore

**Back up:** Settings → **Data & backup** → **Download full backup (.json)**. Keep the file somewhere safe (e.g. iCloud Drive, Google Drive, or a USB stick). It includes all records and attached files. AI keys are never included.

**Restore / move to another device:** open Work OS on the other device → Settings → **Data & backup** → **Import a backup…** and choose the file. Then pick one of two options:
- **Merge** (recommended): adds anything new and updates an item only if the backup's copy is newer. Nothing is deleted.
- **Replace everything**: makes this device exactly match the backup. You'll be asked to type `REPLACE` to confirm, and a restore point is taken first.

On a brand-new device you can also choose **Restore from a backup file** on the welcome screen.

**Spreadsheets:** Data & backup → **Export spreadsheets (CSV)** for tasks, projects, campaigns, press releases, coverage, content, social metrics, KPI values and ideas.

---

## Optional integrations

- **Calendar export (.ics):** Settings → Integrations → *Download .ics*, then import the file into Google Calendar, Apple Calendar or Outlook. It's a one-time copy, not a live sync.
- **Google Calendar two-way sync:** not built yet. It's possible later for free but needs a Google Cloud project with OAuth. The built-in calendar works on its own.
- **Social platform analytics:** not connected. Metrics are entered manually (platform APIs need business accounts and app reviews), so nothing is ever invented.
- **Sync between devices:** not built. See *Future: optional sync* below.

## Optional AI

Work OS never includes or needs an API key, and everything works without AI. With no provider set, the AI Assistant page shows rule-based insights instead (suggested priorities, overdue tasks, stalled projects).

To enable AI: **Settings → AI**, pick a provider, then **Test connection** and **Save**.

### Option A: Ollama (free, fully private, runs on your computer)
1. Download Ollama from <https://ollama.com> and install it.
2. In Terminal, download a model (a few GB, one-time):
   ```bash
   ollama pull llama3.2
   ```
3. In Work OS: Settings → AI → **Ollama (on this computer)** → Test connection → Save.
4. **If you use the hosted version** (e.g. `https://…pages.dev`) instead of `localhost`, Ollama must be told to accept requests from that address. Quit Ollama, then:
   - **macOS:** `launchctl setenv OLLAMA_ORIGINS "https://your-site.pages.dev"` and reopen the Ollama app.
   - **Windows:** System Properties → Environment Variables → add `OLLAMA_ORIGINS` = `https://your-site.pages.dev`, then restart Ollama.
   - **Linux:** `OLLAMA_ORIGINS="https://your-site.pages.dev" ollama serve`

Trade-off: a computer with 8 GB+ of RAM is recommended, and replies are slower than online models. Nothing leaves your machine.

### Option B: LM Studio (free, private, local)
Install from <https://lmstudio.ai>, download a model, start the **Local Server** (port 1234), then choose **LM Studio** in Settings → AI.

### Option C: free online tiers (Groq, OpenRouter, Google AI Studio)
Create a free API key on the provider's site, choose its preset in Settings → AI, and paste the key.
- **What's sent:** only the items you add to the assistant's context, and only when you send a message. The assistant shows a preview of exactly what will be sent.
- **Where the key lives:** only in this browser's local database. It's never in the code or in backups. Anyone with access to your browser profile could read it, so use a free-tier key with no billing attached.
- **Limits:** free tiers have rate limits, and some providers may use free-tier data to improve their models. Check their terms.
- **Never pay by accident:** don't add a payment method to the provider account, and usage can't silently start costing money.

> Claude Code access does **not** include free runtime API access to Claude, so Work OS doesn't assume it.

**What the AI can and can't do:** it can draft, summarise and suggest. It can't change your data. Saving a reply as a note or document, or creating tasks from it, always needs your click, and tasks are shown for review first.

---

## Future: optional sync (not built)

If you later want automatic sync between devices, free options include self-hosting [PocketBase](https://pocketbase.io) or using a free-tier database. Either way, your data would be stored on a server, so it would need authentication and encryption. That's a deliberate decision for later and is tracked in `DEVELOPMENT_STATUS.md`.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| ⌘/Ctrl + K or `/` | Search everything / run a command |
| `N` | Quick add (task, idea, note, project, content, campaign, event, document) |
| `G` then `D` `M` `C` `T` `P` `I` `N` `A` `S` | Go to Dashboard, My Day, Calendar, Tasks, Projects, Ideas, Notes, Analytics, Settings |
| `Esc` | Close a panel |
| ⌘/Ctrl + B / I | Bold / italic in the editor |

---

## For developers

- **Stack:** React 18, TypeScript, Vite 5, Tailwind CSS 3, Dexie 4 (IndexedDB), Recharts, Lucide icons, `vite-plugin-pwa`, Vitest.
- **Structure:**
  ```
  src/
    app/         App shell, routing, layout, navigation, app context
    components/  Reusable UI (ui.tsx), pickers, Markdown editor, charts, search, quick add
    features/    One folder per area (tasks, projects, campaigns, content, notes, …)
    lib/         Data model (types.ts), database (db.ts), repository (repo.ts),
                 domain rules (domain.ts), backup, notifications, search, AI adapters
    test/        Unit tests (Vitest + fake-indexeddb)
  scripts/       Icon generation, mock AI server, end-to-end smoke test
  ```
- **Database changes:** add a new `this.version(N)` block in `src/lib/db.ts` (never edit old ones), bump `SCHEMA_VERSION`, and add a step in `migrateBackup()` in `src/lib/backup.ts`.
- **End-to-end check (optional):** `npm i -D playwright && npx playwright install chromium`, then run `npm run build && npx vite preview --port 4173` and `node scripts/mock-ai-server.cjs` in two terminals, and finally `node scripts/e2e-smoke.cjs`.

See `DEVELOPMENT_STATUS.md` for progress and decisions, and `CLAUDE.md` for notes aimed at Claude Code.
