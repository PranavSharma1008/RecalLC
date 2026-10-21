// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { detectLanguage, matchExactVerdict, matchVerdict, SubmissionTracker } from '../../services/submissionTracker';

function mount(html: string): void {
  document.body.innerHTML = html;
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Timed out waiting for the condition.'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('matchVerdict', () => {
  it('recognises the verdicts LeetCode shows', () => {
    expect(matchVerdict('Verdict: Accepted')).toEqual({ label: 'Accepted', accepted: true });
    expect(matchVerdict('Wrong Answer')).toEqual({ label: 'Wrong Answer', accepted: false });
    expect(matchVerdict('Runtime Error')).toEqual({ label: 'Runtime Error', accepted: false });
    expect(matchVerdict('Time Limit Exceeded')).toEqual({ label: 'Time Limit Exceeded', accepted: false });
    expect(matchVerdict('Memory Limit Exceeded')).toEqual({ label: 'Memory Limit Exceeded', accepted: false });
    expect(matchVerdict('Compilation Error')).toEqual({ label: 'Compilation Error', accepted: false });
  });

  it('ignores text without a verdict', () => {
    expect(matchVerdict('Submit')).toBeNull();
    expect(matchExactVerdict('Your solution is accepted in the problem statement')).toBeNull();
    expect(matchExactVerdict('Verdict: Accepted')).toEqual({ label: 'Accepted', accepted: true });
    expect(matchExactVerdict('Accepted')).toEqual({ label: 'Accepted', accepted: true });
  });
});

describe('detectLanguage', () => {
  it('finds the language inside the editor', () => {
    mount('<div class="editor-container"><button>Python3</button></div>');
    expect(detectLanguage()).toBe('Python3');
  });

  it('prefers a dropdown button', () => {
    mount('<button>Run</button><button aria-haspopup="listbox">Java</button>');
    expect(detectLanguage()).toBe('Java');
  });

  it('returns null when it cannot tell', () => {
    mount('<button>Run</button><button>Submit</button>');
    expect(detectLanguage()).toBeNull();
  });
});

describe('SubmissionTracker', () => {
  it('does not record anything when the page is only opened', async () => {
    mount('<div role="alert">Accepted</div><button>Submit</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    await new Promise((resolve) => setTimeout(resolve, 120));
    tracker.stop();

    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('records an attempt once a verdict appears after a submit', async () => {
    mount('<button id="submit">Submit</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.getElementById('submit')?.click();
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.textContent = 'Accepted';
    document.body.appendChild(panel);

    await waitFor(() => onAttempt.mock.calls.length > 0);
    tracker.stop();

    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0]?.[0]).toMatchObject({ verdict: 'Accepted', accepted: true });
  });

  it('records a failed verdict as not accepted', async () => {
    mount('<button id="submit">Submit</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.getElementById('submit')?.click();
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.textContent = 'Wrong Answer';
    document.body.appendChild(panel);

    await waitFor(() => onAttempt.mock.calls.length > 0);
    tracker.stop();

    expect(onAttempt.mock.calls[0]?.[0]).toMatchObject({ verdict: 'Wrong Answer', accepted: false });
  });

  it('ignores a "Run Code" click', async () => {
    mount('<button id="run">Run Code</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.getElementById('run')?.click();
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.textContent = 'Accepted';
    document.body.appendChild(panel);

    await new Promise((resolve) => setTimeout(resolve, 120));
    tracker.stop();

    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('does not record the same verdict twice', async () => {
    mount('<button id="submit">Submit</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.getElementById('submit')?.click();
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.textContent = 'Accepted';
    document.body.appendChild(panel);

    await waitFor(() => onAttempt.mock.calls.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 60));
    tracker.stop();

    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('detects submit button with data-e2e-locator and multiline verdict panel', async () => {
    mount('<button data-e2e-locator="console-submit-button"><span>Run & Submit</span></button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.querySelector('button')?.click();
    const panel = document.createElement('div');
    panel.setAttribute('data-e2e-locator', 'submission-result');
    panel.innerHTML = '<div>Accepted</div><div>Runtime: 45 ms</div><div>Memory: 16 MB</div>';
    document.body.appendChild(panel);

    await waitFor(() => onAttempt.mock.calls.length > 0);
    tracker.stop();

    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0]?.[0]).toMatchObject({ verdict: 'Accepted', accepted: true });
  });

  it('detects verdict when nested inside a styled span', async () => {
    mount('<button id="submit">Submit</button>');
    const onAttempt = vi.fn();
    const tracker = new SubmissionTracker({ onAttempt, pollIntervalMs: 10 });
    tracker.start();

    document.getElementById('submit')?.click();
    const container = document.createElement('div');
    container.className = 'submission-result-container';
    container.innerHTML = '<span class="text-green-s font-bold">Accepted</span>';
    document.body.appendChild(container);

    await waitFor(() => onAttempt.mock.calls.length > 0);
    tracker.stop();

    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0]?.[0]).toMatchObject({ verdict: 'Accepted', accepted: true });
  });
});
