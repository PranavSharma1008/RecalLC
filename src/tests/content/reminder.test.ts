// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { currentProblemSlug, isProblemPage, observeUrlChanges } from '../../content/reminder';

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
