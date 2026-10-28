/**
 * Submission tracker — detects a *real* submission on a LeetCode problem page.
 *
 * The important distinction this module enforces:
 *
 *   opening a problem  ≠  submitting a solution
 *
 * A problem page is opened all the time; a submission happens rarely and
 * produces a **verdict**. Only a verdict creates an attempt. Opening a page
 * only ever records metadata (and is handled separately by the content
 * script).
 *
 * The tracker is read-only: it listens for clicks and watches the DOM. It
 * never calls `preventDefault`, never stops propagation, never mutates the
 * page and never touches the editor, so LeetCode's own UI behaves exactly as
 * it normally does.
 */

import { isAcceptedOnPage, isInsideConsole } from '../content/reminder';

export interface DetectedAttempt {
  /** Human-readable verdict, e.g. "Accepted" or "Wrong Answer". */
  verdict: string;
  accepted: boolean | null;
  language: string | null;
  /** Epoch ms at which the verdict was detected. */
  at: number;
}

export interface SubmissionTrackerOptions {
  onAttempt: (attempt: DetectedAttempt) => void;
  onSubmit?: () => void;
  /** Poll interval while a submission is in flight. */
  pollIntervalMs?: number;
  /** How long a pending verdict is awaited before giving up. */
  verdictTimeoutMs?: number;
  /** Injectable clock — keeps the tracker testable. */
  now?: () => number;
}

interface VerdictSpec {
  label: string;
  pattern: RegExp;
  accepted: boolean | null;
}

/** Ordered most-specific first: "Wrong Answer" must win over a stray "Answer". */
const VERDICTS: VerdictSpec[] = [
  { label: 'Wrong Answer', pattern: /wrong answer/i, accepted: false },
  { label: 'Runtime Error', pattern: /runtime error/i, accepted: false },
  { label: 'Time Limit Exceeded', pattern: /time limit exceeded/i, accepted: false },
  { label: 'Memory Limit Exceeded', pattern: /memory limit exceeded/i, accepted: false },
  { label: 'Output Limit Exceeded', pattern: /output limit exceeded/i, accepted: false },
  { label: 'Compilation Error', pattern: /compil(?:e|ation)\s+error/i, accepted: false },
  { label: 'Answer Too Long', pattern: /answer too long/i, accepted: false },
  { label: 'Accepted', pattern: /\b(?:accepted|problem solved successfully|correct answer)\b/i, accepted: true },
];

/**
 * A verdict element's whole text must be the verdict for it to be trusted.
 * This is what keeps prose such as "your solution is accepted" from being
 * mistaken for a result.
 */
const EXACT_VERDICT_PATTERN = new RegExp(
  `^(?:verdict\\s*[:\\-]?\\s*)?(${VERDICTS.map((verdict) => verdict.pattern.source).join('|')})[\\s.!✔✓✕✖]*$`,
  'i',
);

const LANGUAGE_PATTERN =
  /^(python3?|py|c\+\+|cpp|cxx|cc|c#|csharp|cs|c|java|javascript|js|typescript|ts|go|golang|rust|rs|ruby|rb|swift|kotlin|kt|scala|php|dart|elixir|clojure|erlang|haskell|hs|perl|lua|pascal|fortran|bash|sh|shell|mysql|postgresql|oracle|mongodb|mssql|sql|r|vb\.net|vb|zig|pandas)$/i;

const SUBMIT_BUTTON_PATTERN = /^\s*submit\b/i;
const RUN_BUTTON_PATTERN = /^\s*run\b|\brun\s*code\b/i;

/** Elements that commonly carry a transient verdict. */
const VERDICT_SELECTORS = [
  '[data-e2e-locator*="submission-result" i]',
  '[data-e2e-locator*="submission" i]',
  '[data-e2e-locator*="result" i]',
  '[data-cypress*="result" i]',
  '[data-cypress*="submission" i]',
  '[class*="result-state" i]',
  '[class*="submission-result" i]',
  '[class*="submission-status" i]',
  '[class*="problem-solved" i]',
  '[class*="compile-status" i]',
  '[class*="output-area" i]',
  '[class*="problems_header_content" i]',
  '[class*="verdict" i]',
  '[class*="toast" i]',
  '[role="alert"]',
  '[role="status"]',
  'span[class*="text-green" i]',
  'span[class*="text-red" i]',
  'div[class*="text-green" i]',
  'div[class*="text-red" i]',
];

function isSubmitButton(element: Element): boolean {
  const tag = element.tagName?.toLowerCase();
  const role = element.getAttribute('role')?.toLowerCase();
  const isButtonLike =
    tag === 'button' ||
    role === 'button' ||
    tag === 'a' ||
    element.classList.contains('btn') ||
    element.classList.contains('button') ||
    (element.className && typeof element.className === 'string' && /btn|button/i.test(element.className));
  if (!isButtonLike) return false;

  const e2e = element.getAttribute('data-e2e-locator') || element.getAttribute('data-cy') || '';
  if (e2e && /run/i.test(e2e) && !/submit/i.test(e2e)) return false;
  if (e2e && /submit/i.test(e2e)) return true;

  const aria = element.getAttribute('aria-label') || element.getAttribute('title') || '';
  if (aria && RUN_BUTTON_PATTERN.test(aria) && !SUBMIT_BUTTON_PATTERN.test(aria)) return false;
  if (aria && SUBMIT_BUTTON_PATTERN.test(aria)) return true;

  if (element.getAttribute('type') === 'submit' && !element.textContent?.trim()) return true;
  const text = (element.textContent ?? '').trim();
  if (!text) return false;
  if (RUN_BUTTON_PATTERN.test(text) && !SUBMIT_BUTTON_PATTERN.test(text)) return false;
  return SUBMIT_BUTTON_PATTERN.test(text) || /\bsubmit\b/i.test(text);
}

export class SubmissionTracker {
  private readonly options: Required<Omit<SubmissionTrackerOptions, 'onAttempt' | 'onSubmit'>> & {
    onAttempt: (attempt: DetectedAttempt) => void;
    onSubmit?: () => void;
  };

  private clickListener: ((event: MouseEvent) => void) | null = null;
  private keyListener: ((event: KeyboardEvent) => void) | null = null;
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while a submission has been fired and its verdict is awaited. */
  private awaitingVerdict = false;
  private awaitingSince = 0;
  private sawExecution = false;
  /** The verdict text observed before the submit click. */
  private baseline: string | null = null;
  /** Guards against recording the same verdict twice. */
  private lastRecorded: { label: string; at: number } | null = null;
  private running = false;

  constructor(options: SubmissionTrackerOptions) {
    this.options = {
      onAttempt: options.onAttempt,
      onSubmit: options.onSubmit,
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      verdictTimeoutMs: options.verdictTimeoutMs ?? 90_000,
      now: options.now ?? (() => Date.now()),
    };
  }

  start(): void {
    if (this.running) return;
    if (typeof document === 'undefined') return;
    this.running = true;

    this.clickListener = (event: MouseEvent) => this.handleClick(event);
    document.addEventListener('click', this.clickListener, true);

    this.keyListener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        this.triggerSubmit();
      }
    };
    document.addEventListener('keydown', this.keyListener, true);

    this.observer = new MutationObserver(() => {
      if (this.awaitingVerdict) this.checkForVerdict();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    this.pollTimer = setInterval(() => {
      if (this.awaitingVerdict) this.checkForVerdict();
    }, this.options.pollIntervalMs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener, true);
      this.clickListener = null;
    }
    if (this.keyListener) {
      document.removeEventListener('keydown', this.keyListener, true);
      this.keyListener = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    this.awaitingVerdict = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /* ------------------------------------------------------------- internals */

  private handleClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('button, [role="button"], a, div[class*="btn" i], div[class*="button" i]');
    if (!button || !isSubmitButton(button)) return;

    this.triggerSubmit();
  }

  private triggerSubmit(): void {
    this.awaitingVerdict = true;
    this.awaitingSince = this.options.now();
    this.sawExecution = false;
    this.baseline = this.readVerdictText();
    this.options.onSubmit?.();

    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => this.checkForVerdict(), 800);
  }

  private isExecuting(): boolean {
    if (typeof document === 'undefined') return false;
    const bodyText = ((document.body?.innerText || '') + ' ' + (document.body?.textContent || '')).slice(0, 100000);
    if (/\b(?:judging|evaluating|pending|running|compiling)\b/i.test(bodyText)) return true;
    const submitBtn = document.querySelector(
      '[data-e2e-locator="console-submit-button"], [data-cypress="submit-code-btn"], [data-cy="submit-code-btn"]',
    );
    if (submitBtn && (submitBtn.hasAttribute('disabled') || submitBtn.getAttribute('aria-disabled') === 'true')) {
      return true;
    }
    const activeSpinner = document.querySelector(
      '[data-e2e-locator*="submission" i] [class*="spin" i], [data-e2e-locator*="console" i] [class*="spin" i], [class*="submission" i] [class*="load" i], [class*="submission" i] svg.animate-spin, button[disabled] [class*="spin" i], [aria-busy="true"]',
    );
    if (activeSpinner && !activeSpinner.closest('.monaco-editor, header, nav')) return true;
    return false;
  }

  /**
   * The current verdict shown on the page, as a comparable string.
   * Returns `null` when no verdict is visible.
   */
  private readVerdictText(): string | null {
    if (typeof document === 'undefined') return null;

    for (const selector of VERDICT_SELECTORS) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (
          node.closest(
            '.monaco-editor, .ace_editor, header, nav, [class*="description" i], [class*="editorial" i], [class*="discussion" i], [class*="solutions" i]',
          )
        )
          continue;
        if (isInsideConsole(node)) continue;

        const text = (node.textContent ?? '').trim();
        if (!text || text.length > 300) continue;
        const match = matchExactVerdict(text);
        if (match) return match.label;

        // If the element contains "testcases passed" and "accepted" / "problem solved" / "correct"
        const tcMatch = text.match(/\b(\d+)\s*\/\s*(\d+)\s*(?:test\s*cases?|testcases)\s+passed\b/i);
        if (
          tcMatch &&
          (/\baccepted\b/i.test(text) || /problem solved successfully/i.test(text) || /correct/i.test(text))
        ) {
          const passed = Number(tcMatch[1]);
          const total = Number(tcMatch[2]);
          if (passed > 0 && passed === total) {
            return 'Accepted';
          }
        }

        if (/problem solved successfully/i.test(text) || /^correct answer/i.test(text)) {
          return 'Accepted';
        }

        // If the element has multiple lines (e.g. verdict followed by runtime/memory stats)
        const firstLine = text.split('\n')[0]?.trim();
        if (firstLine && firstLine !== text) {
          const firstLineMatch = matchExactVerdict(firstLine);
          if (firstLineMatch) return firstLineMatch.label;
        }

        // Check child elements for a direct verdict match
        for (const child of Array.from(node.children)) {
          if (isInsideConsole(child)) continue;
          const childText = (child.textContent ?? '').trim();
          if (childText && childText.length <= 120) {
            const childMatch = matchExactVerdict(childText);
            if (childMatch) return childMatch.label;
          }
        }
      }
    }

    // Direct check if page reports accepted submission
    if (isAcceptedOnPage()) {
      return 'Accepted';
    }

    return null;
  }

  private checkForVerdict(): void {
    if (!this.awaitingVerdict) return;

    const elapsed = this.options.now() - this.awaitingSince;
    if (elapsed > this.options.verdictTimeoutMs) {
      this.awaitingVerdict = false;
      return;
    }

    // While LeetCode is judging or pending testcases, wait until judging completes!
    if (this.isExecuting()) {
      this.sawExecution = true;
      return;
    }

    const current = this.readVerdictText();
    if (!current) return;
    if (!this.sawExecution && current === this.baseline) return;
    if (this.lastRecorded && this.lastRecorded.label === current && this.options.now() - this.lastRecorded.at < 5000) {
      return;
    }

    const spec = VERDICTS.find((verdict) => verdict.label === current);
    if (!spec) return;

    // For "Accepted" verdicts, only record if isAcceptedOnPage() confirms full submission passed.
    // Never record "Accepted" from sample testcases.
    if (spec.accepted && !isAcceptedOnPage()) {
      return;
    }

    this.awaitingVerdict = false;
    this.lastRecorded = { label: spec.label, at: this.options.now() };

    this.options.onAttempt({
      verdict: spec.label,
      accepted: spec.accepted,
      language: detectLanguage(),
      at: this.options.now(),
    });
  }
}

/** Find the first verdict mentioned in a chunk of text. */
export function matchVerdict(text: string): { label: string; accepted: boolean | null } | null {
  for (const verdict of VERDICTS) {
    if (verdict.pattern.test(text)) {
      return { label: verdict.label, accepted: verdict.accepted };
    }
  }
  return null;
}

/**
 * Match a text that is *exactly* a verdict (optionally prefixed with
 * "Verdict:"). Used for verdict panels, where the whole element is the result.
 */
export function matchExactVerdict(text: string): { label: string; accepted: boolean | null } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120) return null;
  if (!EXACT_VERDICT_PATTERN.test(trimmed)) return null;
  return matchVerdict(trimmed);
}

/**
 * Best-effort detection of the currently selected editor language.
 * Returns `null` when it cannot be determined — never guesses.
 */
export function detectLanguage(root: ParentNode = document): string | null {
  const selects = Array.from(root.querySelectorAll('select'));
  for (const select of selects) {
    const text = select.value || (select.options[select.selectedIndex]?.text ?? '');
    if (text && LANGUAGE_PATTERN.test(text.trim())) {
      return text.trim();
    }
  }

  const candidates = Array.from(root.querySelectorAll('button, [role="button"], select'));

  let fallback: string | null = null;
  for (const candidate of candidates) {
    const text = (candidate.textContent ?? '').trim();
    if (!text || text.length > 24) continue;
    if (!LANGUAGE_PATTERN.test(text)) continue;

    const inEditor = Boolean(candidate.closest('#editor, [class*="editor" i], [data-e2e-locator*="editor" i]'));
    if (inEditor) return text;

    const looksLikeDropdown =
      candidate.getAttribute('aria-haspopup') === 'listbox' || candidate.getAttribute('aria-expanded') !== null;
    if (looksLikeDropdown) return text;

    if (!fallback) fallback = text;
  }
  return fallback;
}
