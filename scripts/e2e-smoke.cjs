// End-to-end smoke test of key workflows in a real browser.
// Needs: `npm run build && npx vite preview --port 4173` and `node scripts/mock-ai-server.cjs` running.
// Run:   node scripts/e2e-smoke.cjs [screenshot-dir]
const { chromium, devices } = require('playwright');
const BASE = 'http://localhost:4173';
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  global.__page = p;
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));

  console.log('Onboarding (empty workspace)');
  await p.goto(BASE);
  await p.fill('input[placeholder="Your first name"]', 'Tester');
  await p.click('text=An empty workspace');
  await p.click('text=Open my workspace');
  await p.waitForSelector('text=Good');
  ok(await p.isVisible('text=Tester'), 'greeting shows name');

  console.log('Quick add task + persistence');
  await p.keyboard.press('n');
  await p.fill('input[placeholder="What needs doing?"]', 'E2E write launch plan');
  await p.keyboard.press('Enter');
  await p.waitForSelector('text=Task added');
  await p.goto(BASE + '/tasks');
  await p.waitForSelector('text=E2E write launch plan');
  await p.reload();
  ok(await p.waitForSelector('text=E2E write launch plan'), 'task survives reload');

  console.log('Task drawer edit + autosave');
  await p.click('text=E2E write launch plan');
  await p.fill('textarea[placeholder^="Add context"]', 'Some description');
  await p.waitForTimeout(900);
  await p.keyboard.press('Escape');
  await p.reload();
  await p.click('text=E2E write launch plan');
  ok((await p.inputValue('textarea[placeholder^="Add context"]')) === 'Some description', 'description autosaved');
  await p.keyboard.press('Escape');

  console.log('Project from template');
  await p.goto(BASE + '/projects');
  await p.click('text=New project');
  await p.fill('input[placeholder="Project name"]', 'E2E Event');
  await p.selectOption('select:near(:text("Template"))', { label: 'Event' });
  await p.click('button:has-text("Create project")');
  await p.waitForURL(/\/projects\/.+/);
  await p.click('button[role="tab"]:has-text("Tasks")');
  ok(await p.isVisible('text=Book venue'), 'template tasks created');

  console.log('Note with wiki link');
  await p.goto(BASE + '/notes');
  await p.click('[aria-label="New note"]');
  await p.fill('input[placeholder="Untitled"]', 'E2E Note');
  await p.fill('textarea[placeholder^="Start writing"]', '# Heading\n- [ ] check item');
  await p.waitForTimeout(1000);
  await p.reload();
  ok((await p.inputValue('input[placeholder="Untitled"]')) === 'E2E Note', 'note title saved');

  console.log('Global search');
  await p.keyboard.press('Control+k');
  await p.keyboard.type('launch plan');
  await p.waitForSelector('[role="dialog"] >> text=E2E write launch plan');
  ok(true, 'search finds task');
  await p.keyboard.press('Escape');

  console.log('AI assistant with mock local server');
  await p.goto(BASE + '/settings?tab=ai');
  await p.click('text=LM Studio (on this computer)');
  await p.click('button:has-text("Save")');
  await p.click('button:has-text("Test connection")');
  await p.waitForSelector('text=Connected', { timeout: 10000 });
  ok(true, 'connection test passes');
  await p.goto(BASE + '/assistant');
  await p.fill('textarea[placeholder^="Ask"]', 'Make me a plan');
  await p.keyboard.press('Enter');
  await p.waitForSelector('text=Publish on Friday', { timeout: 10000 });
  ok(true, 'streamed reply rendered');
  await p.click('button:has-text("Create tasks…")');
  await p.click('button:has-text("Create 3 task(s)")');
  await p.waitForSelector('text=3 task(s) created');
  await p.goto(BASE + '/tasks');
  ok(await p.waitForSelector('text=Review with the team'), 'tasks created only after confirmation');

  console.log('Backup export');
  await p.goto(BASE + '/settings?tab=data');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Download full backup (.json)')]);
  const json = JSON.parse(require('node:fs').readFileSync(await dl.path(), 'utf8'));
  ok(json.app === 'work-os' && json.tables.tasks.length >= 4, 'backup file contains tasks');

  console.log('Theme');
  await p.goto(BASE + '/settings?tab=appearance');
  await p.click('button:has-text("Dusk")');
  await p.waitForFunction(() => document.documentElement.classList.contains('dark'));
  ok(await p.evaluate(() => document.documentElement.classList.contains('dark')), 'dark mode applied');
  await p.reload();
  ok(await p.evaluate(() => document.documentElement.classList.contains('dark')), 'dark mode persists');
  await p.goto(BASE + '/');
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/e2e-dark.png' });

  console.log('Mobile layout');
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await m.newPage();
  await mp.goto(BASE);
  await mp.fill('input[placeholder="Your first name"]', 'Mobile');
  await mp.click('text=Open my workspace');
  await mp.waitForSelector('nav[aria-label="Mobile"]');
  ok(true, 'bottom navigation shown on phone');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: out + '/e2e-mobile.png' });

  ok(errors.length === 0, 'no runtime errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('\nAll E2E checks passed');
})().catch(async (e) => {
  console.error(e.message);
  try { await global.__page.screenshot({ path: out + '/e2e-failure.png' }); console.error('Screenshot: ' + out + '/e2e-failure.png'); } catch {}
  process.exit(1);
});
