import { getPopularProblem } from '../data/popularProblems';
import { callService } from '../services/messaging';
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

  // 2. Check LeetCode DOM difficulty badges & classes
  const degreeElements = Array.from(
    document.querySelectorAll(
      '[data-degree], [class*="difficulty" i], [class*="text-easy" i], [class*="text-olive" i], [class*="text-yellow" i], [class*="text-hard" i], [class*="text-pink" i], [class*="text-red" i]',
    ),
  );
  for (const el of degreeElements) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (text === 'easy') return 'Easy';
    if (text === 'medium') return 'Medium';
    if (text === 'hard') return 'Hard';
  }

  // 3. Problem description header elements
  const candidates = Array.from(document.querySelectorAll('span, div, button, p'));
  for (const el of candidates) {
    if (el.closest('.monaco-editor, #editor, [role="tablist"], nav, header')) continue;
    const text = (el.textContent || '').trim();
    if (text === 'Easy') return 'Easy';
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

  // 2. Monaco editor view-lines container text
  try {
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines && viewLines.textContent?.trim()) {
      const cleaned = cleanExtractedCode(viewLines.textContent);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 3. Monaco textarea
  try {
    const ta = document.querySelector('.monaco-editor textarea');
    if (ta instanceof HTMLTextAreaElement && ta.value.trim()) {
      const cleaned = cleanExtractedCode(ta.value);
      if (cleaned) return cleaned;
    }
  } catch {
    // ignore
  }

  // 4. Accepted submission or code pre block on page
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

export async function pushProblemToRecallLC(currentSlug: string): Promise<boolean> {
  if (!currentSlug) return false;

  const lang = detectLanguage();
  const title = titleFromSlug(currentSlug);
  const detectedDiff = detectDifficultyFromPage();
  const difficulty =
    detectedDiff !== 'Unknown' ? detectedDiff : currentSlug.toLowerCase() === 'two-sum' ? 'Easy' : undefined;
  const rawCode = extractEditorCode();
  const code = cleanExtractedCode(rawCode);

  // 1. Record the attempt in RecallLC with difficulty
  await callService('record-attempt', {
    slug: currentSlug,
    title,
    difficulty,
    attemptedAt: Date.now(),
    accepted: true,
    language: lang,
    source: 'manual',
  });

  // 2. If code was extracted, save to problem notes (ensuring code is only added ONCE, never duplicated)
  if (code.trim()) {
    const existing = await callService('get-problem', { slug: currentSlug });
    const currentNotes = existing?.problem?.notes || '';
    const notesToSave = upsertSolutionCode(currentNotes, code, lang || 'code');
    await callService('update-notes', {
      slug: currentSlug,
      notes: notesToSave,
    });
  }

  return true;
}
