# Notes for Claude Code

Work OS is a single-user, local-first PWA. The owner is not a software engineer: explain changes in plain language, give exact commands, and never claim something is deployed or connected unless it has been verified.

## Hard rules
- **¥0 running cost.** No paid services, no usage-billed APIs, and no dependency that needs an API key for core features. Ask before adding any external service.
- **No API keys in source.** AI keys live only in the user's IndexedDB settings and are stripped from backups (`redactSettings` in `src/lib/backup.ts`).
- **Never silently overwrite or delete user data.** Use soft delete (`softDelete` → Trash) and confirmations. Imports default to merge.
- **AI may only suggest/draft.** Any write that results from AI output must go through an explicit user confirmation.
- **No mock data presented as real.** Sample data must use `isDemo: true` (see `src/lib/demo.ts`).
- Keep `DEVELOPMENT_STATUS.md` updated when features change.

## Commands
```bash
npm run dev        # dev server
npx tsc -b         # type-check
npm test           # unit tests (Vitest, fake-indexeddb, node env)
npm run build      # type-check + production build (PWA)
```
Optional E2E: build, then run `npx vite preview --port 4173` and `node scripts/mock-ai-server.cjs`, then `node scripts/e2e-smoke.cjs <screenshot-dir>` (needs Playwright).

## Architecture map
- `src/lib/types.ts`: the whole data model. Every record extends `BaseRecord` (`id`, timestamps, `deletedAt`, `isDemo`).
- `src/lib/db.ts`: Dexie schema. **To change the schema, add `this.version(N+1)`**, bump `SCHEMA_VERSION`, and add a step in `migrateBackup()`.
- `src/lib/repo.ts`: `create` / `update` / `softDelete` / `restore` / `purge` (they log activity) and task status logic (recurrence).
- `src/lib/hooks.ts`: live queries (`useTasks`, …), `useDraft` (load, edit, autosave), `useAutosave`.
- `src/lib/domain.ts`: labels, colours, scoring, and the **project progress formula** (documented in-code and in the UI).
- `src/lib/entities.ts`: entity → table/route/title mapping used by search, links, the trash and the AI context.
- `src/lib/settings.ts`: settings stored in `kv` under `settings`; dashboard widget layout.
- `src/lib/backup.ts`: export/import/validation/CSV/restore points.
- `src/lib/ai.ts`: provider adapters + presets. `src/features/assistant/context.ts` serialises the selected context.
- `src/features/*`: one folder per screen. Global drawers (task, content, event) live in `src/app/Layout.tsx` and open via `useApp()`.
- UI primitives: `src/components/ui.tsx`; colour tokens: `src/index.css` (use `bg-surface`, `text-muted`, `border-line`, `text-accent`, …, never raw colours).

## Gotchas
- Effects must use block bodies. `useEffect(() => el.scrollIntoView())` returns a Promise in newer Chrome, and React then crashes calling it as a clean-up function.
- Wrap `localStorage` access in try/catch (`safeGet` in `utils.ts`).
- Blob storage in tests requires `// @vitest-environment node`.
