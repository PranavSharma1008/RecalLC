import { getPopularProblem } from '../data/popularProblems';
import { callService, isExtensionContextValid, notifyContextInvalidated } from '../services/messaging';
import { detectLanguage } from '../services/submissionTracker';
import { cleanExtractedCode, upsertSolutionCode } from '../utils/notes';
import { titleFromSlug } from '../utils/slug';

export function detectDifficultyFromPage(): 'Easy' | 'Medium' | 'Hard' | 'Unknown' {
  if (typeof document === 'undefined') return 'Unknown';

  // 1. Check LeetCode Next.js __NEXT_DATA__ JSON script tag
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl && nextDataEl.textContent) {
      const match = nextDataEl.textContent.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/i);
      if (match && match[1]) {
        return (match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()) as 'Easy' | 'Medium' | 'Hard';
      }
    }
  } catch {
    // ignore
  }

  // 2. Check LeetCode & GeeksforGeeks DOM difficulty badges & classes
  const degreeElements = Array.from(
    document.querySelectorAll(
      '[data-degree], [class*="difficulty" i], [class*="text-easy" i], [class*="text-olive" i], [class*="text-yellow" i], [class*="text-hard" i], [class*="text-pink" i], [class*="text-red" i], [class*="badge" i], [class*="level" i]',
    ),
  );
  for (const el of degreeElements) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (
      text === 'school' ||
      text === 'basic' ||
      text === 'easy' ||
      text.includes('difficulty: school') ||
      text.includes('difficulty: basic') ||
      text.includes('difficulty: easy')
    ) {
      return 'Easy';
    }
    if (text === 'medium' || text.includes('difficulty: medium')) return 'Medium';
    if (text === 'hard' || text.includes('difficulty: hard')) return 'Hard';
  }

  // 3. Problem description header elements
  const candidates = Array.from(document.querySelectorAll('span, div, button, p'));
  for (const el of candidates) {
    if (el.closest('.monaco-editor, .ace_editor, #editor, [role="tablist"], nav, header')) continue;
    const text = (el.textContent || '').trim();
    if (text === 'School' || text === 'Basic' || text === 'Easy') return 'Easy';
    if (text === 'Medium') return 'Medium';
    if (text === 'Hard') return 'Hard';
  }

  // 4. Built-in dictionary fallback from URL pathname
  try {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (match && match[1]) {
      const popular = getPopularProblem(match[1]);
      if (popular && popular.difficulty !== 'Unknown') return popular.difficulty;
    }
  } catch {
    // ignore
  }

  return 'Unknown';
}

/**
 * Extracts the real problem title from the page DOM (supporting both LeetCode and GeeksforGeeks).
 */
export function extractTitleFromPage(): string | null {
  if (typeof document === 'undefined') return null;

  // 1. GeeksforGeeks problem header elements
  try {
    const gfgTitleEl = document.querySelector<HTMLElement>(
      '.problem-tab__title, .problems_header_content__title, [class*="problemTitle" i], [class*="problem_title" i], [class*="problemHead" i] h3, [class*="problemHead" i] h1',
    );
    if (gfgTitleEl && gfgTitleEl.textContent?.trim()) {
      return gfgTitleEl.textContent.trim();
    }
  } catch {
    // ignore
  }

  // 2. Document title for GeeksforGeeks: "Title | Practice | GeeksforGeeks"
  try {
    if (window.location.hostname.includes('geeksforgeeks.org') && document.title) {
      const part = document.title.split('|')[0]?.trim();
      if (part && !/geeksforgeeks/i.test(part) && !/practice/i.test(part)) {
        return part;
      }
    }
  } catch {
    // ignore
  }

  // 3. Document title for LeetCode: "Title - LeetCode"
  try {
    if (window.location.hostname.includes('leetcode.com') && document.title) {
      const part = document.title.split('-')[0]?.trim();
      if (part && !/leetcode/i.test(part)) {
        return part;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function extractEditorCode(): string {
  // 1. Monaco editor view lines
  try {
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
    if (lines.length > 0) {
      lines.sort((a, b) => (a as HTMLElement).offsetTop - (b as HTMLElement).offsetTop);
      const code = lines.map((l) => (l as HTMLElement).innerText || '').join('\n');
      const cleaned = cleanExtractedCode(code);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 2. Ace editor view lines (common in GFG and other code platforms)
  try {
    const aceLines = Array.from(document.querySelectorAll('.ace_editor .ace_line'));
    if (aceLines.length > 0) {
      aceLines.sort((a, b) => (a as HTMLElement).offsetTop - (b as HTMLElement).offsetTop);
      const code = aceLines.map((l) => (l as HTMLElement).innerText || '').join('\n');
      const cleaned = cleanExtractedCode(code);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 3. Monaco editor view-lines container text
  try {
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines && viewLines.textContent?.trim()) {
      const cleaned = cleanExtractedCode(viewLines.textContent);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 4. Monaco or Ace textarea
  try {
    const ta = document.querySelector('.monaco-editor textarea, .ace_editor textarea');
    if (ta instanceof HTMLTextAreaElement && ta.value.trim()) {
      const cleaned = cleanExtractedCode(ta.value);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 5. CodeMirror editor lines
  try {
    const cmLines = Array.from(document.querySelectorAll('.CodeMirror-line'));
    if (cmLines.length > 0) {
      const code = cmLines.map((l) => (l as HTMLElement).innerText || '').join('\n');
      const cleaned = cleanExtractedCode(code);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 6. Accepted submission or code pre block on page
  try {
    const codeBlocks = Array.from(document.querySelectorAll('pre code, pre, [class*="submission"] code'));
    for (const block of codeBlocks) {
      const text = block.textContent || '';
      if (
        text.includes('class Solution') ||
        text.includes('def ') ||
        text.includes('function') ||
        text.includes('pub fn') ||
        text.includes('func ') ||
        text.includes('impl ') ||
        text.includes('solution') ||
        text.length > 20
      ) {
        const cleaned = cleanExtractedCode(text);
        if (cleaned) return cleaned;
      }
    }
  } catch {
    // ignore
  }

  return '';
}

let lastInterceptedCode: string | undefined;
let lastInterceptedLang: string | undefined;

export function setInterceptedSubmission(code?: string, lang?: string): void {
  if (code) lastInterceptedCode = code;
  if (lang) lastInterceptedLang = lang;
}

export function clearInterceptedSubmission(): void {
  lastInterceptedCode = undefined;
  lastInterceptedLang = undefined;
}

export async function pushProblemToRecallLC(
  currentSlug: string,
  source: 'manual' | 'auto' = 'manual',
  providedCode?: string,
  providedLang?: string,
): Promise<boolean> {
  if (!currentSlug) return false;
  if (!isExtensionContextValid()) {
    notifyContextInvalidated();
    return false;
  }

  const lang = providedLang || lastInterceptedLang || detectLanguage();
  const pageTitle = extractTitleFromPage();
  const title = pageTitle || titleFromSlug(currentSlug);
  const detectedDiff = detectDifficultyFromPage();
  const difficulty =
    detectedDiff !== 'Unknown' ? detectedDiff : currentSlug.toLowerCase() === 'two-sum' ? 'Easy' : undefined;
  const rawCode = providedCode || lastInterceptedCode || extractEditorCode();
  const code = cleanExtractedCode(rawCode);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : undefined;

  // 1. Record the attempt in RecallLC with difficulty and current platform URL
  try {
    await callService('record-attempt', {
      slug: currentSlug,
      title,
      url: currentUrl,
      difficulty,
      attemptedAt: Date.now(),
      accepted: true,
      language: lang,
      source,
    });
  } catch (err) {
    if (!isExtensionContextValid()) {
      notifyContextInvalidated();
      return false;
    }
    throw err;
  }

  // 2. If code was extracted, save to problem notes (ensuring code is only added ONCE, never duplicated)
  try {
    if (code.trim() && isExtensionContextValid()) {
      const existing = await callService('get-problem', { slug: currentSlug });
      const currentNotes = existing?.problem?.notes || '';
      const notesToSave = upsertSolutionCode(currentNotes, code, lang || 'code');
      await callService('update-notes', {
        slug: currentSlug,
        notes: notesToSave,
      });
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ 'recalllc:data_version': Date.now() }).catch(() => {});
    }
  } catch (err) {
    if (!isExtensionContextValid()) return false;
    console.debug?.('[RecallLC] Problem notes update skipped:', err);
  }

  // Notify all open extension tabs (Dashboard, Popup) to immediately refresh data
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    void chrome.storage.local.set({ 'recalllc:data_version': Date.now() }).catch(() => {});
  }

  return true;
}
