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

  it('returns false when user runs sample testcases in the console (Run Code)', () => {
    document.body.innerHTML = `
      <div id="console" class="console-panel">
        <div class="flex items-center test-result-tabs">
          <div role="tab" class="tab-item">Testcase</div>
          <div role="tab" class="tab-item active">Test Result</div>
        </div>
        <div class="test-result-content">
          <div class="flex items-center gap-2">
            <span class="text-green-500 font-medium">Accepted</span>
            <span class="text-xs text-gray-400">Runtime: 0 ms</span>
          </div>
          <div class="case-tabs flex gap-2">
            <div class="case-tab">Case 1</div>
            <div class="case-tab">Case 2</div>
          </div>
          <div class="input-details">
            <p>grid =</p>
            <pre>[[1,3,1],[1,5,1],[4,2,1]]</pre>
          </div>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns false when user runs sample testcases in modern LeetCode split-pane without id console', () => {
    document.body.innerHTML = `
      <div class="flex flex-col h-full bg-layer-1">
        <div class="flex items-center">
          <div role="tab">Testcase</div>
          <div role="tab">Test Result</div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <div role="alert" class="text-green-500 font-semibold">Accepted</div>
            <span class="text-xs">Runtime: 1 ms</span>
          </div>
          <div class="flex gap-2">
            <div>Case 1</div>
            <div>Case 2</div>
          </div>
          <div>
            <p>n = 3</p>
          </div>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns false when a submission failed and only partial testcases passed (e.g. 12 / 66 passed)', () => {
    document.body.innerHTML = `
      <div class="submission-details">
        <span class="text-red-500 font-medium">Wrong Answer</span>
        <span class="text-label-3">12 / 66 testcases passed</span>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns true when a full submission has all testcases passed (e.g. 66 / 66 testcases passed)', () => {
    document.body.innerHTML = `
      <div class="submission-details">
        <span class="text-green-500 font-medium">Accepted</span>
        <span class="text-label-3">66 / 66 testcases passed</span>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('returns false on problem description page load with Editorial Complexity Analysis and Solution', () => {
    document.body.innerHTML = `
      <div class="description-tab">
        <h2>72. Edit Distance</h2>
        <span class="badge">Solved ✔</span>
      </div>
      <div class="editorial-content">
        <h3>Complexity Analysis</h3>
        <p>Time complexity: O(M * N)</p>
        <p>Solution approach: Dynamic Programming</p>
      </div>
      <div class="console">
        <p>You must run your code first</p>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns false on page open when code editor is untouched even if previously solved', () => {
    document.body.innerHTML = `
      <header>
        <a href="/problems/edit-distance/">72. Edit Distance</a>
        <span>Solved ✔</span>
      </header>
      <div class="monaco-editor">
        class Solution { public int minDistance(String word1, String word2) {} }
      </div>
      <div class="test-result-panel">
        <p>You must run your code first</p>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(false);
  });

  it('returns true when LeetCode modern submission with Beats is shown even with Case 1 in the DOM', () => {
    document.body.innerHTML = `
      <div class="split-pane">
        <div class="console-dock">
          <div role="tab">Testcase</div>
          <div>Case 1</div>
          <div>Case 2</div>
        </div>
        <div class="submission-area">
          <div class="flex items-center gap-2">
            <span class="text-green-500 font-bold text-xl">Accepted</span>
            <span>Runtime: 38 ms</span>
            <span class="text-green-400">Beats 89.2%</span>
            <span>Memory: 16.4 MB</span>
            <span class="text-green-400">Beats 76.5%</span>
          </div>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });

  it('returns true when LeetCode displays 66 / 66 testcases passed even with Case 1 in the DOM', () => {
    document.body.innerHTML = `
      <div class="split-pane">
        <div class="console-dock">
          <div>Case 1</div>
          <div>Case 2</div>
          <div>Custom Input</div>
        </div>
        <div class="submission-container">
          <div class="text-green-500">Accepted</div>
          <div>66 / 66 testcases passed</div>
        </div>
      </div>
    `;
    expect(isAcceptedOnPage()).toBe(true);
  });
});
