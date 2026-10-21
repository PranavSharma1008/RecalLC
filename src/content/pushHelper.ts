import { callService } from '../services/messaging';
import { detectLanguage } from '../services/submissionTracker';
import { titleFromSlug } from '../utils/slug';

export function extractEditorCode(): string {
  // 1. Monaco editor view lines
  try {
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
    if (lines.length > 0) {
      lines.sort((a, b) => (a as HTMLElement).offsetTop - (b as HTMLElement).offsetTop);
      const code = lines.map((l) => (l as HTMLElement).innerText || '').join('\n');
      if (code.trim()) return code;
    }
  } catch {
    // ignore
  }

  // 2. Monaco editor view-lines container text
  try {
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    if (viewLines && viewLines.textContent?.trim()) {
      return viewLines.textContent.trim();
    }
  } catch {
    // ignore
  }

  // 3. Monaco textarea
  try {
    const ta = document.querySelector('.monaco-editor textarea');
    if (ta instanceof HTMLTextAreaElement && ta.value.trim()) {
      return ta.value;
    }
  } catch {
    // ignore
  }

  // 4. Accepted submission or code pre block on page
  try {
    const codeBlocks = Array.from(document.querySelectorAll('pre code, pre, [class*="submission"] code'));
    for (const block of codeBlocks) {
      const text = block.textContent || '';
      if (text.includes('class Solution') || text.includes('def ') || text.includes('function') || text.length > 30) {
        return text.trim();
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
  const code = extractEditorCode();

  // 1. Record the attempt in RecallLC
  await callService('record-attempt', {
    slug: currentSlug,
    title,
    attemptedAt: Date.now(),
    accepted: true,
    language: lang,
    source: 'manual',
  });

  // 2. If code was extracted, save to problem notes
  if (code.trim()) {
    const langTag = lang || 'code';
    const codeNote = `Solution Code (${langTag}):\n\`\`\`${lang || ''}\n${code}\n\`\`\``;
    const existing = await callService('get-problem', { slug: currentSlug });
    const existingNotes = existing?.problem?.notes ? `${existing.problem.notes}\n\n` : '';
    await callService('update-notes', {
      slug: currentSlug,
      notes: `${existingNotes}${codeNote}`,
    });
  }

  return true;
}
