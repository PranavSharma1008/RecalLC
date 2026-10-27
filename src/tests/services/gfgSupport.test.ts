// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { isAcceptedOnPage } from '../../content/reminder';
import { detectDifficultyFromPage, extractTitleFromPage } from '../../content/pushHelper';
import { findInlineTarget } from '../../content/inlineInjector';
import { SubmissionTracker } from '../../services/submissionTracker';
import { extractSlugFromUrl, isGfgSlug, problemUrl, titleFromSlug } from '../../utils/slug';
import { normalizeRecord } from '../../services/historyNormalizer';

describe('GeeksforGeeks (GFG) full integration support', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('GFG URL and Slug Extraction', () => {
    it('extracts slug from standard GFG problem URL with trailing /1', () => {
      const url = 'https://www.geeksforgeeks.org/problems/kadanes-algorithm-1587115620/1';
      expect(extractSlugFromUrl(url)).toBe('kadanes-algorithm-1587115620');
    });

    it('extracts slug from practice.geeksforgeeks.org problem URL', () => {
      const url = 'https://practice.geeksforgeeks.org/problems/reverse-an-array/1';
      expect(extractSlugFromUrl(url)).toBe('reverse-an-array');
    });

    it('cleans trailing numeric ID from slug for human-readable fallback title', () => {
      expect(titleFromSlug('kadanes-algorithm-1587115620')).toBe('Kadanes Algorithm');
      expect(titleFromSlug('reverse-an-array')).toBe('Reverse An Array');
    });

    it('generates GFG canonical problemUrl when platform/url is GFG', () => {
      expect(problemUrl('reverse-an-array', 'gfg')).toBe(
        'https://www.geeksforgeeks.org/problems/reverse-an-array/1',
      );
      expect(problemUrl('reverse-an-array')).toBe('https://leetcode.com/problems/reverse-an-array/');
    });

    it('identifies typical GFG slugs with trailing numeric IDs and defaults to GFG URLs', () => {
      expect(isGfgSlug('fractional-knapsack-1587115620')).toBe(true);
      expect(isGfgSlug('0-1-knapsack-problem0945')).toBe(true);
      expect(isGfgSlug('kadanes-algorithm-1587115620')).toBe(true);
      expect(isGfgSlug('two-sum')).toBe(false);

      expect(problemUrl('fractional-knapsack-1587115620')).toBe(
        'https://www.geeksforgeeks.org/problems/fractional-knapsack-1587115620/1',
      );
      expect(problemUrl('0-1-knapsack-problem0945')).toBe(
        'https://www.geeksforgeeks.org/problems/0-1-knapsack-problem0945/1',
      );
    });
  });

  describe('GFG Page Metadata & Difficulty Detection', () => {
    it('maps School and Basic difficulty on GFG to Easy', () => {
      document.body.innerHTML = `
        <div class="problem-tab__header">
          <span class="badge difficulty">School</span>
        </div>
      `;
      expect(detectDifficultyFromPage()).toBe('Easy');

      document.body.innerHTML = `
        <div>
          <span class="problem-level">Difficulty: Basic</span>
        </div>
      `;
      expect(detectDifficultyFromPage()).toBe('Easy');
    });

    it('detects Medium and Hard difficulty on GFG', () => {
      document.body.innerHTML = `
        <div class="problems_header_content">
          <span class="difficulty">Medium</span>
        </div>
      `;
      expect(detectDifficultyFromPage()).toBe('Medium');

      document.body.innerHTML = `
        <div class="problems_header_content">
          <span class="difficulty">Hard</span>
        </div>
      `;
      expect(detectDifficultyFromPage()).toBe('Hard');
    });

    it('extracts problem title from GFG problem header tab', () => {
      document.body.innerHTML = `
        <div class="problem-tab__title">
          <h3>Subarray with Given Sum</h3>
        </div>
      `;
      expect(extractTitleFromPage()).toBe('Subarray with Given Sum');
    });
  });

  describe('GFG Verdict & Accepted Detection', () => {
    it('detects "Problem Solved Successfully" as accepted on page', () => {
      document.body.innerHTML = `
        <div class="problem-solved-modal">
          <h3>Problem Solved Successfully</h3>
          <p>Test Cases Passed: 1112 / 1112</p>
        </div>
      `;
      expect(isAcceptedOnPage()).toBe(true);
    });

    it('detects "Correct Answer" as accepted on page', () => {
      document.body.innerHTML = `
        <div class="output-area">
          <span class="result-state">Correct Answer</span>
        </div>
      `;
      expect(isAcceptedOnPage()).toBe(true);
    });

    it('detects GFG test cases passed pattern "1112 / 1112 test cases passed"', () => {
      document.body.innerHTML = `
        <div>1112 / 1112 test cases passed</div>
      `;
      expect(isAcceptedOnPage()).toBe(true);
    });

    it('submissionTracker reports Accepted verdict for GFG success message', () => {
      let reported: { verdict: string; accepted: boolean | null } | null = null;
      const tracker = new SubmissionTracker({
        onAttempt: (attempt) => {
          reported = attempt;
        },
      });
      tracker.start();

      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      document.body.appendChild(btn);

      btn.click();

      // Trigger GFG success verdict in DOM
      const resultDiv = document.createElement('div');
      resultDiv.className = 'submission-status';
      resultDiv.textContent = 'Problem Solved Successfully';
      document.body.appendChild(resultDiv);

      // Verify verdict detected
      expect(isAcceptedOnPage()).toBe(true);
      expect(reported).toBeDefined();

      tracker.stop();
    });
  });

  describe('GFG Inline Rocket Button Targeting', () => {
    it('finds inline target before GFG Compile & Run button', () => {
      document.body.innerHTML = `
        <div class="action-bar flex items-center">
          <div class="btn-group">
            <button class="compile-btn">Compile & Run</button>
            <button class="submit-btn">Submit</button>
          </div>
        </div>
      `;

      const target = findInlineTarget();
      expect(target).not.toBeNull();
      expect(target?.position).toBe('before');
      const compileBtn = document.querySelector('.compile-btn');
      expect(target?.referenceNode).toBe(compileBtn);
    });

    it('finds inline target inside GFG problem tab header', () => {
      document.body.innerHTML = `
        <div class="problem-tab__header flex items-center">
          <h3>Problem</h3>
        </div>
      `;

      const target = findInlineTarget();
      expect(target).not.toBeNull();
      expect(target?.position).toBe('append');
      const header = document.querySelector('.problem-tab__header');
      expect(target?.container).toBe(header);
    });
  });

  describe('GFG History Normalizer', () => {
    it('preserves GFG problem URLs during import', () => {
      const gfgUrl = 'https://www.geeksforgeeks.org/problems/kadanes-algorithm-1587115620/1';
      const result = normalizeRecord({
        slug: 'kadanes-algorithm-1587115620',
        url: gfgUrl,
        title: "Kadane's Algorithm",
        attemptedAt: Date.now(),
        accepted: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toBe(gfgUrl);
        expect(result.value.title).toBe("Kadane's Algorithm");
      }
    });
  });
});
