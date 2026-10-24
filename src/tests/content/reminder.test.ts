// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { currentProblemSlug, isAcceptedOnPage, isProblemPage, observeUrlChanges } from '../../content/reminder';
import { findInlineTarget } from '../../content/inlineInjector';

function setUrl(path: string): void {
  // Relative paths only: jsdom refuses to navigate to a different origin.
  window.history.replaceState({}, '', path);
}

describe('currentProblemSlug', () => {
  it('reads the slug from a problem URL', () => {
    setUrl('/problems/two-sum/');
    expect(currentProblemSlug()).toBe('two-sum');
  });

  it('reads the slug from a URL without a trailing slash', () => {
    setUrl('/problems/number-of-islands');
    expect(currentProblemSlug()).toBe('number-of-islands');
  });

  it('ignores a URL with extra path segments', () => {
    setUrl('/problems/two-sum/solutions/');
    expect(currentProblemSlug()).toBe('two-sum');
  });

  it('returns null off a problem page', () => {
    setUrl('/problemset/');
    expect(currentProblemSlug()).toBeNull();
    expect(isProblemPage()).toBe(false);
  });

  it('returns null for the problemset root', () => {
    setUrl('/');
    expect(currentProblemSlug()).toBeNull();
  });
});

describe('observeUrlChanges', () => {
  it('reports navigation to a different problem', async () => {
    setUrl('/problems/two-sum/');
    const onChange = vi.fn();
    const stop = observeUrlChanges(onChange);

    setUrl('/problems/coin-change/');
    document.body.appendChild(document.createElement('div'));

    await new Promise((resolve) => setTimeout(resolve, 300));
    stop();

    expect(onChange).toHaveBeenCalledWith('coin-change');
  });

  it('does not report the same URL twice', async () => {
    setUrl('/problems/two-sum/');
    const onChange = vi.fn();
    const stop = observeUrlChanges(onChange);

    document.body.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    stop();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('findInlineTarget', () => {
  it('finds the top navigation bar after random question button', () => {
    document.body.innerHTML = `
      <header class="flex items-center">
        <a href="/problemset/all/">Problem List</a>
        <a href="/problems/random-one-question/" class="random-btn">🔀</a>
      </header>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('after');
    expect(target?.referenceNode?.className).toContain('random-btn');
  });
});

describe('isAcceptedOnPage', () => {
  it('detects when testcases passed and Accepted text are present', () => {
    document.body.innerHTML = `
      <div class="flex items-center">
        <h4>Accepted ✔</h4>
        <span>66 / 66 testcases passed</span>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('detects Analysis and Solution buttons', () => {
    document.body.innerHTML = `
      <div>
        <button>✨ Analysis</button>
        <button>📝 Solution</button>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('detects active Accepted tab', () => {
    document.body.innerHTML = `
      <div role="tablist">
        <div role="tab">Accepted ✕</div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('detects accepted submission from LeetCode modern submission details layout', () => {
    document.body.innerHTML = `
      <div class="submission-details">
        <span class="text-green-500 font-medium">Accepted✔</span>
        <span class="text-label-3">1036 / 1036 testcases passed</span>
        <div class="flex items-center gap-2">
          <button class="bg-purple-600">✨ Analysis</button>
          <button class="bg-emerald-600">📝 Solution</button>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('returns false when no accepted indicator is present', () => {
    document.body.innerHTML = `
      <div>
        <button>Run Code</button>
        <button>Submit</button>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns false when "You must run your code first" is shown and no accepted indicator is present', () => {
    document.body.innerHTML = `
      <div>
        <div class="test-result">You must run your code first</div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns true when submission is accepted even if console shows "You must run your code first"', () => {
    document.body.innerHTML = `
      <div class="submission-details">
        <span class="text-green-500">Accepted ✔</span>
        <span>1569 / 1569 testcases passed</span>
        <button>✨ Analysis</button>
        <button>📝 Solution</button>
      </div>
      <div class="console-tab">
        <p>You must run your code first</p>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('returns false on problem description statistics such as "Accepted 5.2M"', () => {
    document.body.innerHTML = `
      <div class="problem-description">
        <p>Example 1: Input: [2,7,11,15]</p>
        <div class="stats">
          <span>Accepted 5.2M</span>
          <span>Submissions 10.4M</span>
          <span>Acceptance Rate 50.1%</span>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });
});
