// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { findInlineTarget } from '../../content/inlineInjector';

describe('findInlineTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no relevant elements exist', () => {
    document.body.innerHTML = '<div><h1>Home</h1></div>';
    expect(findInlineTarget()).toBeNull();
  });

  it('finds inline target after random question button in the top navigation bar', () => {
    document.body.innerHTML = `
      <header class="flex items-center justify-between">
        <div class="nav-left flex items-center">
          <a href="/problemset/all/">Problem List</a>
          <button aria-label="Previous Question">&lt;</button>
          <button aria-label="Next Question">&gt;</button>
          <a href="/problems/random-one-question/" class="random-btn">🔀</a>
        </div>
        <div class="nav-center flex items-center">
          <button data-e2e-locator="console-run-button">Run</button>
        </div>
      </header>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('after');
    const randomBtn = document.querySelector('.random-btn');
    expect(target?.referenceNode).toBe(randomBtn);
  });

  it('finds inline target when random button is inside a tooltip wrapper div', () => {
    document.body.innerHTML = `
      <header class="flex items-center">
        <div class="nav-left flex items-center">
          <a href="/problemset/all/">Problem List</a>
          <div class="relative random-wrapper">
            <a href="/problems/random-one-question/">🔀</a>
          </div>
        </div>
      </header>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('after');
    const wrapper = document.querySelector('.random-wrapper');
    expect(target?.referenceNode).toBe(wrapper);
  });

  it('finds inline target after the last item in Problem List navigation group if random link is absent', () => {
    document.body.innerHTML = `
      <div class="flex items-center top-bar">
        <a href="/problemset/all/">Problem List</a>
        <button class="nav-prev">&lt;</button>
        <button class="nav-next">&gt;</button>
      </div>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('after');
    const nextBtn = document.querySelector('.nav-next');
    expect(target?.referenceNode).toBe(nextBtn);
  });

  it('falls back to inserting before the Run button cluster', () => {
    document.body.innerHTML = `
      <div class="top-bar flex items-center">
        <div class="run-group flex items-center">
          <button class="debugger-btn">Bug</button>
          <button data-e2e-locator="console-run-button">Run</button>
        </div>
      </div>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('before');
    const debuggerBtn = document.querySelector('.debugger-btn');
    expect(target?.referenceNode).toBe(debuggerBtn);
  });

  it('falls back to appending to top nav if only header/nav is available', () => {
    document.body.innerHTML = `
      <header>
        <div class="left-cluster">
          <span>LeetCode</span>
        </div>
      </header>
    `;

    const target = findInlineTarget();
    expect(target).not.toBeNull();
    expect(target?.position).toBe('append');
    const leftCluster = document.querySelector('.left-cluster');
    expect(target?.container).toBe(leftCluster);
  });

  it('does NOT target submission body buttons (Solution/Analysis removed)', () => {
    document.body.innerHTML = `
      <div class="submission-details">
        <button class="btn-analysis">✨ Analysis</button>
        <button class="btn-solution">📝 Solution</button>
      </div>
    `;

    // Must be null because we removed submission body targeting!
    expect(findInlineTarget()).toBeNull();
  });
});
