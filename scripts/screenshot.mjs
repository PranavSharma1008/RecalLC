/**
 * Captures screenshots of the RecallLC popup and dashboard from a real
 * Chrome, so the visual design can be reviewed without opening a browser.
 *
 *   node scripts/screenshot.mjs [out-dir]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const OUT = resolve(process.argv[2] ?? '/tmp/recalllc-shots');
const PORT = 9334;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    this.child.stdio[3].write(`${JSON.stringify({ id, method, params })}\0`);
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

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.contexts = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve());
      this.socket.addEventListener('error', () => reject(new Error('ws error')));
    });
    this.socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.executionContextCreated') this.contexts.push(msg.params.context);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
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
  async attach() {
    await this.send('Runtime.enable');
    const started = Date.now();
    while (Date.now() - started < 8000) {
      if (this.contexts.length) return;
      await sleep(100);
    }
  }
  async evaluate(expression) {
    const context = this.contexts[this.contexts.length - 1];
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(context ? { contextId: context.id } : {}),
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

const profile = mkdtempSync(join(tmpdir(), 'recalllc-shot-'));
mkdirSync(OUT, { recursive: true });

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
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--disable-gpu',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
);

async function getJson(path) {
  return (await fetch(`http://127.0.0.1:${PORT}${path}`)).json();
}

async function openPage(extensionId, path, width, height) {
  const response = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/${path}`)}`,
    { method: 'PUT' },
  );
  const target = await response.json();
  for (let i = 0; i < 60; i++) {
    const list = await getJson('/json/list');
    const found = list.find((t) => t.id === target.id);
    if (found?.webSocketDebuggerUrl) {
      const cdp = new Cdp(found.webSocketDebuggerUrl);
      await cdp.ready;
      await cdp.attach();
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: false,
      });
      return cdp;
    }
    await sleep(150);
  }
  throw new Error(`Could not open ${path}`);
}

try {
  const pipe = new PipeClient(chrome);
  const { id: extensionId } = await pipe.send('Extensions.loadUnpacked', { path: DIST });
  console.log('extension', extensionId);

  const dash = await openPage(extensionId, 'src/dashboard/index.html', 1280, 900);
  await sleep(1200);

  // Seed realistic data through the real import path.
  await dash.evaluate(`
    (async () => {
      const sample = JSON.stringify([
        { slug: 'two-sum', title: 'Two Sum', attemptedAt: Date.now() - 12 * 86400000, accepted: true, language: 'python3', submissionId: 'shot-1' },
        { slug: 'climbing-stairs', title: 'Climbing Stairs', attemptedAt: Date.now() - 6 * 86400000, accepted: false, language: 'cpp', submissionId: 'shot-2' },
        { slug: 'climbing-stairs', title: 'Climbing Stairs', attemptedAt: Date.now() - 5 * 86400000, accepted: true, language: 'cpp', submissionId: 'shot-3' },
        { slug: 'maximum-subarray', title: 'Maximum Subarray', attemptedAt: Date.now() - 4 * 86400000, accepted: true, language: 'python3', submissionId: 'shot-4' },
        { slug: 'coin-change', title: 'Coin Change', attemptedAt: Date.now() - 3 * 86400000, accepted: true, language: 'java', submissionId: 'shot-5' },
        { slug: 'number-of-islands', title: 'Number of Islands', attemptedAt: Date.now() - 2 * 86400000, accepted: false, language: 'typescript', submissionId: 'shot-6' },
        { slug: 'word-search', title: 'Word Search', attemptedAt: Date.now() - 1 * 86400000, accepted: true, language: 'python3', submissionId: 'shot-7' },
        { slug: 'course-schedule', title: 'Course Schedule', attemptedAt: Date.now() - 1 * 86400000, accepted: true, language: 'cpp', submissionId: 'shot-8' }
      ]);
      await chrome.runtime.sendMessage({ channel: 'recalllc', method: 'import-commit', payload: { fileName: 'shots.json', content: sample } });
      return true;
    })()
  `);
  await sleep(500);

  const shots = [
    ['dashboard-overview', 'src/dashboard/index.html', 1280, 980],
    ['dashboard-problems', 'src/dashboard/index.html#/problems', 1280, 980],
    ['dashboard-import', 'src/dashboard/index.html#/import', 1280, 980],
    ['dashboard-settings', 'src/dashboard/index.html#/settings', 1280, 980],
    ['dashboard-recall', 'src/dashboard/index.html#/recall/coin-change', 1280, 980],
    ['popup', 'src/popup/index.html', 400, 620],
  ];

  for (const [name, path, width, height] of shots) {
    const cdp = await openPage(extensionId, path, width, height);
    await sleep(1600);
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `${name}.png`);
    writeFileSync(file, Buffer.from(result.data, 'base64'));
    console.log('wrote', file);
    cdp.close();
  }

  dash.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
