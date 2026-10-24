/**
 * End-to-end verification of the in-page reminder and submission tracker
 * on a simulated LeetCode page.
 *
 * Runs headless Chrome over CDP, loads a patched unpacked extension (with
 * local mock URL match), serves a problem page at
 * `http://127.0.0.1:8765/problems/two-sum/`, and asserts:
 *   1. `#recalllc-root` island mounts onto the page,
 *   2. The reminder card displays a due problem (Coin Change),
 *   3. The currently open problem (Two Sum) is excluded from the reminder,
 *   4. Clicking Submit on the page triggers verdict detection,
 *   5. The attempt is recorded in the extension's database,
 *   6. Snoozing the reminder removes the card from the screen.
 *
 *   node scripts/verify-content-script.mjs [path-to-dist]
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const HTTP_PORT = 8765;
const CDP_PORT = 9336;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}${path}`);
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

  async attach(timeoutMs = 8000) {
    await this.send('Runtime.enable');
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.contexts.length > 0) return;
      await sleep(100);
    }
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed');
    }
    return result.result.value;
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

/* -------------------------------------------------------------- mock server */

function startMockLeetCodeServer() {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/problems/two-sum')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Two Sum - LeetCode</title>
  <style>
    body { font-family: sans-serif; background: #1a1a1a; color: #fff; padding: 24px; }
    .btn { padding: 8px 16px; background: #2cbb5d; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
    #result-area { margin-top: 16px; font-size: 16px; font-weight: bold; }
    .text-green-s { color: #2cbb5d; }
  </style>
</head>
<body>
  <h1>1. Two Sum</h1>
  <p>Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.</p>
  <div>
    <button id="submit-btn" data-e2e-locator="console-submit-button" class="btn">Submit</button>
  </div>
  <div id="result-area"></div>
  <script>
    document.getElementById('submit-btn').addEventListener('click', () => {
      setTimeout(() => {
        const area = document.getElementById('result-area');
        area.innerHTML = '<div data-e2e-locator="submission-result" class="text-green-s">Accepted</div>';
      }, 150);
    });
  </script>
</body>
</html>`);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server));
  });
}

/* --------------------------------------------------------------------- main */

const tempDist = mkdtempSync(join(tmpdir(), 'recalllc-content-dist-'));
const profile = mkdtempSync(join(tmpdir(), 'recalllc-content-profile-'));
let chrome = null;
let server = null;
let exitCode = 0;

try {
  // 1. Copy dist and patch manifest to match http://127.0.0.1/*
  cpSync(DIST, tempDist, { recursive: true });
  const manifestPath = join(tempDist, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const localPattern = 'http://127.0.0.1/*';
  manifest.host_permissions = [...(manifest.host_permissions ?? []), localPattern];
  if (manifest.content_scripts?.[0]) {
    manifest.content_scripts[0].matches = [...(manifest.content_scripts[0].matches ?? []), localPattern];
  }
  if (manifest.web_accessible_resources?.[0]) {
    manifest.web_accessible_resources[0].matches = ['<all_urls>'];
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 2. Start mock LeetCode server
  server = await startMockLeetCodeServer();
  console.log(`Mock LeetCode server running at http://127.0.0.1:${HTTP_PORT}`);

  // 3. Launch Chrome with extension
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
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

  const pipe = new PipeClient(chrome);
  const loaded = await pipe.send('Extensions.loadUnpacked', { path: tempDist });
  const extensionId = loaded.id;
  console.log(`Extension loaded: ${extensionId}\n`);

  // Wait for SW
  for (let i = 0; i < 50; i++) {
    const targets = await getJson('/json/list');
    const worker = targets.find((t) => t.type === 'service_worker' && t.url.includes(extensionId));
    if (worker) break;
    await sleep(150);
  }

  // 4. Open dashboard page to seed the database and configure settings
  const dashRes = await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/src/dashboard/index.html`)}`,
    { method: 'PUT' },
  );
  const dashTarget = await dashRes.json();
  const dashCdp = new Cdp(dashTarget.webSocketDebuggerUrl);
  await dashCdp.ready;
  await dashCdp.attach();
  await sleep(1000);

  console.log('1) Seeding initial data via extension page');
  await dashCdp.evaluate(`
    (async () => {
      const send = async (method, payload) => {
        const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
        if (!response || response.ok === false) throw new Error(response?.error ?? 'failed');
        return response.data;
      };

      // Set reminder delay to 0 so the reminder appears immediately
      await send('update-settings', { reminderDelayMs: 0, remindersEnabled: true, autoTrackSubmissions: true });

      // Import coin-change (overdue by 4 days given 6-day default interval)
      const sample = JSON.stringify([
        {
          slug: 'coin-change',
          title: 'Coin Change',
          attemptedAt: Date.now() - 10 * 86400000,
          accepted: true,
          language: 'python3',
          submissionId: 'init-1'
        }
      ]);
      await send('import-commit', { fileName: 'init.json', content: sample });
    })()
  `);
  check('seeded coin-change problem and set reminder delay to 0ms', true);

  // 5. Open mock LeetCode problem page
  console.log('\n2) In-page reminder on simulated LeetCode');
  const pageRes = await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`http://127.0.0.1:${HTTP_PORT}/problems/two-sum/`)}`,
    { method: 'PUT' },
  );
  const pageTarget = await pageRes.json();
  const pageCdp = new Cdp(pageTarget.webSocketDebuggerUrl);
  await pageCdp.ready;
  await pageCdp.attach();

  // Wait for the content script to run and mount #recalllc-root
  let rootFound = false;
  let reminderHtml = '';
  for (let i = 0; i < 40; i++) {
    const checkHost = await pageCdp.evaluate(`
      (() => {
        const root = document.getElementById('recalllc-root');
        if (!root) return { found: false, html: '' };
        return { found: true, html: root.innerHTML, text: root.innerText };
      })()
    `);
    if (checkHost.found && checkHost.text && checkHost.text.includes('Coin Change')) {
      rootFound = true;
      reminderHtml = checkHost.text;
      break;
    }
    await sleep(250);
  }

  check('content script mounts #recalllc-root container', rootFound);
  check('reminder card displays due problem — "Coin Change"', reminderHtml.includes('Coin Change'));
  check('reminder card excludes current problem — "Two Sum"', !reminderHtml.includes('Two Sum'));

  // 6. Test submission tracking on page
  console.log('\n3) Submission tracking on page');
  await pageCdp.evaluate(`
    (() => {
      const btn = document.getElementById('submit-btn');
      btn.click();
    })()
  `);

  // Wait for verdict to appear and for the tracker to record it
  await sleep(1500);

  const trackerResult = JSON.parse(
    await dashCdp.evaluate(`
      (async () => {
        const send = async (method, payload) => {
          const response = await chrome.runtime.sendMessage({ channel: 'recalllc', method, payload });
          return response?.data;
        };
        const prob = await send('get-problem', { slug: 'two-sum' });
        return JSON.stringify(prob);
      })()
    `),
  );

  check('submission on page creates a problem record for two-sum', Boolean(trackerResult.problem));
  check('problem title is Two Sum', trackerResult.problem?.title === 'Two Sum');
  check('attempt count is 1', trackerResult.problem?.attemptCount === 1);
  check('verdict is recorded as accepted', trackerResult.problem?.accepted === true);
  check('an attempt record is stored', trackerResult.attempts?.length === 1);

  // 7. Test in-page snooze action
  console.log('\n4) In-page reminder interactions');
  const snoozed = await pageCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('#recalllc-root button'));
      const snoozeBtn = buttons.find(b => b.textContent && b.textContent.includes('Remind Tomorrow'));
      if (snoozeBtn) {
        snoozeBtn.click();
        return true;
      }
      return false;
    })()
  `);
  check('user can click "Remind Tomorrow" inside the reminder', snoozed);

  await sleep(600);

  const afterSnoozeText = await pageCdp.evaluate(`
    (() => {
      const root = document.getElementById('recalllc-root');
      return root ? root.innerText : '';
    })()
  `);
  check('reminder card disappears after snooze', !afterSnoozeText.includes('Coin Change'));

  dashCdp.close();
  pageCdp.close();
} catch (error) {
  console.error('\nVerification failed:', error);
  exitCode = 1;
} finally {
  if (chrome) {
    try {
      chrome.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
  }
  rmSync(tempDist, { recursive: true, force: true });
  rmSync(profile, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else if (exitCode === 0) {
  console.log('\nAll in-page content script checks passed.');
  process.exit(0);
} else {
  process.exit(exitCode);
}
