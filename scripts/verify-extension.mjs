/**
 * End-to-end smoke test: loads the built extension into a real Chrome using
 * the DevTools `Extensions.loadUnpacked` command, then drives the extension
 * over the DevTools protocol. No third-party dependencies.
 *
 *   node scripts/verify-extension.mjs [path-to-dist]
 *
 * Checks:
 *   1. the service worker starts and the manifest is exactly what we expect,
 *   2. the real message API + IndexedDB write path work (import, schedule,
 *      rate, statistics) — driven from an extension page, exactly like the UI,
 *   3. de-duplication works on re-import,
 *   4. the currently open problem is excluded from the reminder,
 *   5. snoozing removes a problem from the queue without rescheduling it,
 *   6. the popup and dashboard render without console errors,
 *   7. data survives a service-worker restart.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

/* ------------------------------------------------------- browser pipe client */

class PipeClient {
  constructor(child) {
    this.child = child;
    this.id = 0;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);

    child.stdio[4].on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      let index;
      while ((index = this.buffer.indexOf(0)) !== -1) {
        const raw = this.buffer.subarray(0, index).toString('utf8');
        this.buffer = this.buffer.subarray(index + 1);
        if (!raw) continue;
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          continue;
        }
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) reject(new Error(JSON.stringify(message.error)));
          else resolve(message.result);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    const payload = JSON.stringify({ id, method, params });
    this.child.stdio[3].write(`${payload}\0`);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 20000);
    });
  }
}

/* --------------------------------------------------------- page-level client */

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.contexts = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve());
      this.socket.addEventListener('error', () => reject(new Error('websocket error')));
    });
    this.socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.executionContextCreated') {
        this.contexts.push(msg.params.context);
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Enable the runtime and wait until an extension execution context exists. */
  async attach(timeoutMs = 8000) {
    await this.send('Runtime.enable');
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.extensionContext()) return;
      await sleep(100);
    }
    throw new Error('No extension execution context became available.');
  }

  /** The most recent context that belongs to the extension origin. */
  extensionContext() {
    const matches = this.contexts.filter((c) => String(c.origin ?? '').startsWith('chrome-extension://'));
    return matches[matches.length - 1] ?? null;
  }

  async evaluate(expression) {
    const candidates = [
      ...this.contexts.filter((c) => String(c.origin ?? '').startsWith('chrome-extension://')),
      ...this.contexts,
    ];
    const seen = new Set();
    let lastError = null;
    for (const context of candidates) {
      if (seen.has(context.id)) continue;
      seen.add(context.id);
      try {
        const result = await this.send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
          contextId: context.id,
        });
        if (result.exceptionDetails) {
          lastError = new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed');
          continue;
        }
        return result.result.value;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('evaluation failed');
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------------------------------------------------ harness */

const failures = [];
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function openPage(extensionId, path) {
  const response = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/${path}`)}`,
    { method: 'PUT' },
  );
  const target = await response.json();

  for (let i = 0; i < 60; i++) {
    const list = await getJson('/json/list');
    const found = list.find((t) => t.id === target.id);
    if (found?.webSocketDebuggerUrl) return found;
    await sleep(150);
  }
  throw new Error(`Could not open ${path}`);
}

const profile = mkdtempSync(join(tmpdir(), 'recalllc-verify-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-extensions-with-background-pages',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
);

let exitCode = 0;
try {
  const pipe = new PipeClient(chrome);
  const loaded = await pipe.send('Extensions.loadUnpacked', { path: DIST });
  const extensionId = loaded.id;
  console.log(`Chrome: ${(await getJson('/json/version')).Browser}`);
  console.log(`Extension loaded: ${extensionId}\n`);

  /* ---------------------------------------------------------- 1. manifest */

  let worker = null;
  for (let i = 0; i < 80; i++) {
    const targets = await getJson('/json/list');
    worker = targets.find((t) => t.type === 'service_worker' && t.url.includes(extensionId)) ?? null;
    if (worker) break;
    await sleep(250);
  }
  if (!worker) throw new Error('The extension service worker never started');
  console.log(`Service worker: ${worker.url}\n`);

  const swCdp = new Cdp(worker.webSocketDebuggerUrl);
  await swCdp.ready;
  await swCdp.attach();
  const swLocation = await swCdp.evaluate('String(self.location && self.location.href)');
  check('the service worker runs from the extension origin', String(swLocation).includes(extensionId));

  console.log('1) Manifest');
  const parsed = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
  check('manifest version is 3', parsed.manifest_version === 3);
  check(
    'permissions are minimal',
    JSON.stringify(parsed.permissions) === '["storage"]',
    JSON.stringify(parsed.permissions),
  );
  check(
    'host permissions are limited to leetcode and geeksforgeeks',
    parsed.host_permissions?.includes('https://leetcode.com/*') &&
      parsed.host_permissions?.includes('https://*.geeksforgeeks.org/*'),
    JSON.stringify(parsed.host_permissions),
  );
  check('background service worker is registered', Boolean(parsed.background?.service_worker));
  check(
    'content script matches problem pages',
    Boolean(parsed.content_scripts?.[0]?.matches?.includes('https://leetcode.com/problems/*')),
  );
  check('the popup is registered', Boolean(parsed.action?.default_popup));
  check('the dashboard is registered as the options page', Boolean(parsed.options_ui?.page));

  /* -------------------------------------------- 2. the real message + data path */

  console.log('\n2) Message API and database (driven from an extension page)');
  const dashboardTarget = await openPage(extensionId, 'src/dashboard/index.html');
  const page = new Cdp(dashboardTarget.webSocketDebuggerUrl);
  await page.ready;
  await page.attach();
  await page.send('Log.enable');
  await sleep(1500);

  const outcome = JSON.parse(
    await page.evaluate(`
      (async () => {
        const send = async (method, payload) => {
          const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
          if (!response) throw new Error('no response for ' + method);
          if (response.ok === false) throw new Error(method + ': ' + response.error);
          return response.data;
        };
        const sample = JSON.stringify([
          { slug: 'two-sum', title: 'Two Sum', attemptedAt: Date.now() - 10 * 86400000, accepted: true, language: 'python3', submissionId: 'verify-1' },
          { slug: 'coin-change', title: 'Coin Change', attemptedAt: Date.now() - 8 * 86400000, accepted: true, language: 'java', submissionId: 'verify-2' }
        ]);
        const preview = await send('import-preview', { fileName: 'v.json', content: sample });
        const commit = await send('import-commit', { fileName: 'v.json', content: sample });
        const stats = await send('stats');
        const due = await send('list-due');
        const problems = await send('list-problems');
        return JSON.stringify({ previewValid: preview.valid.length, commit, stats, dueCount: due.length, problems: problems.length });
      })()
    `),
  );
  check('import preview validates both rows', outcome.previewValid === 2, `valid=${outcome.previewValid}`);
  check('import writes the attempts', outcome.commit.imported === 2, `imported=${outcome.commit.imported}`);
  check(
    'import creates the problems',
    outcome.commit.problemsCreated === 2,
    `created=${outcome.commit.problemsCreated}`,
  );
  check(
    'statistics reflect the stored data',
    outcome.stats.totalProblems === 2,
    `tracked=${outcome.stats.totalProblems}`,
  );
  check('both problems are due for revision', outcome.dueCount === 2, `due=${outcome.dueCount}`);
  check('the problem list is joined with its schedule', outcome.problems === 2);

  const reimport = JSON.parse(
    await page.evaluate(`
      (async () => {
        const send = async (method, payload) => {
          const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
          if (!response) throw new Error('no response for ' + method);
          if (response.ok === false) throw new Error(method + ': ' + response.error);
          return response.data;
        };
        const sample = JSON.stringify([
          { slug: 'two-sum', title: 'Two Sum', attemptedAt: Date.now() - 10 * 86400000, accepted: true, language: 'python3', submissionId: 'verify-1' },
          { slug: 'coin-change', title: 'Coin Change', attemptedAt: Date.now() - 8 * 86400000, accepted: true, language: 'java', submissionId: 'verify-2' }
        ]);
        const commit = await send('import-commit', { fileName: 'v.json', content: sample });
        const stats = await send('stats');
        return JSON.stringify({ commit, stats });
      })()
    `),
  );
  check('re-importing duplicates nothing', reimport.commit.imported === 0 && reimport.commit.duplicated === 2);
  check('the problem count is unchanged', reimport.stats.totalProblems === 2);

  const rating = JSON.parse(
    await page.evaluate(`
      (async () => {
        const send = async (method, payload) => {
          const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
          if (!response) throw new Error('no response for ' + method);
          if (response.ok === false) throw new Error(method + ': ' + response.error);
          return response.data;
        };
        const before = await send('list-due');
        const rated = await send('rate', { slug: 'two-sum', rating: 'good' });
        const after = await send('list-due');
        const excluded = await send('get-reminder', { currentSlug: 'coin-change' });
        const included = await send('get-reminder', { currentSlug: 'two-sum' });
        const dueBeforeSnooze = (await send('list-due')).length;
        const revisionBeforeSnooze = await send('get-problem', { slug: 'coin-change' });
        const snoozed = await send('snooze', { slug: 'coin-change' });
        const afterSnooze = await send('list-due');
        const revisionAfterSnooze = await send('get-problem', { slug: 'coin-change' });
        return JSON.stringify({
          before: before.length,
          rated,
          after: after.length,
          excluded: excluded.candidate,
          included: included.candidate?.slug,
          snoozed,
          dueBeforeSnooze,
          afterSnooze: afterSnooze.length,
          dueBefore: revisionBeforeSnooze.revision.dueAt,
          dueAfter: revisionAfterSnooze.revision.dueAt,
          snoozedUntil: revisionAfterSnooze.revision.snoozedUntil,
        });
      })()
    `),
  );
  check('rating reschedules the problem', rating.rated?.dueAt > Date.now());
  check('the rated problem leaves the due list', rating.after === rating.before - 1);
  check('the current problem is excluded from the reminder', rating.excluded === null);
  check('another due problem is offered', rating.included === 'coin-change', String(rating.included));
  check('snoozing removes a problem from the queue', rating.afterSnooze === 0, `due=${rating.afterSnooze}`);
  check('snoozing does not change the schedule', rating.dueAfter === rating.dueBefore);
  check('snoozing sets a snooze date', Boolean(rating.snoozedUntil));

  /* ---------------------------------------------------------- 3. the pages */

  console.log('\n3) Extension pages');
  const rootLength = await page.evaluate(`document.getElementById('root')?.innerHTML?.length ?? 0`);
  check('the dashboard renders content', rootLength > 300, `${rootLength} characters`);
  const dashText = await page.evaluate(`document.body.innerText.slice(0, 300)`);
  check('the dashboard shows RecallLC branding', String(dashText).includes('RecallLC'));

  const popupTarget = await openPage(extensionId, 'src/popup/index.html');
  const popup = new Cdp(popupTarget.webSocketDebuggerUrl);
  await popup.ready;
  await popup.attach();
  await popup.send('Log.enable');
  await sleep(1500);

  const popupLength = await popup.evaluate(`document.getElementById('root')?.innerHTML?.length ?? 0`);
  check('the popup renders content', popupLength > 200, `${popupLength} characters`);
  const popupText = await popup.evaluate(`document.body.innerText.slice(0, 300)`);
  check('the popup shows RecallLC branding', String(popupText).includes('RecallLC'));
  check(
    'the popup shows the due count',
    /due today/i.test(String(popupText)),
    String(popupText).replace(/\s+/g, ' ').slice(0, 90),
  );

  for (const [name, cdp] of [
    ['the dashboard', page],
    ['the popup', popup],
  ]) {
    const errors = cdp.events.filter(
      (e) =>
        e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error'),
    );
    const noise = errors.filter((e) => !/favicon/i.test(JSON.stringify(e.params ?? {})));
    check(`${name} logs no errors`, noise.length === 0, noise.length ? JSON.stringify(noise[0]).slice(0, 300) : '');
  }

  /* ------------------------------------------ 4. persistence across a restart */

  console.log('\n4) Persistence across a service-worker restart');
  await swCdp.send('ServiceWorker.stopAllWorkers').catch(() => undefined);
  await sleep(1500);

  let restarted = null;
  for (let i = 0; i < 40; i++) {
    const targets = await getJson('/json/list');
    restarted = targets.find((t) => t.type === 'service_worker' && t.url.includes(extensionId)) ?? null;
    if (restarted) break;
    await sleep(250);
  }
  check('the service worker restarts on demand', Boolean(restarted));

  const persisted = JSON.parse(
    await page.evaluate(`
      (async () => {
        const send = async (method, payload) => {
          const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
          if (!response) throw new Error('no response for ' + method);
          if (response.ok === false) throw new Error(method + ': ' + response.error);
          return response.data;
        };
        const stats = await send('stats');
        const backup = await send('export');
        const problem = await send('get-problem', { slug: 'two-sum' });
        return JSON.stringify({
          tracked: stats.totalProblems,
          reviews: stats.totalReviews,
          backupProblems: backup.problems.length,
          backupAttempts: backup.attempts.length,
          rating: problem.revision.lastRating,
        });
      })()
    `),
  );
  check('data survives a service-worker restart', persisted.tracked === 2, `tracked=${persisted.tracked}`);
  check('the review history survives too', persisted.reviews === 1, `reviews=${persisted.reviews}`);
  check('the backup contains the problems', persisted.backupProblems === 2);
  check('the backup contains the attempts', persisted.backupAttempts === 2);
  check('the review rating is persisted', persisted.rating === 'good', String(persisted.rating));

  page.close();
  popup.close();
  swCdp.close();
} catch (error) {
  console.error('\nVerification crashed:', error);
  exitCode = 1;
} finally {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n - ${failures.join('\n - ')}`);
  exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
process.exit(exitCode);
