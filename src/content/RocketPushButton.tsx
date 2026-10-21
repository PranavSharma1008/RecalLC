import { useState } from 'react';

import { callService } from '../services/messaging';
import { detectLanguage } from '../services/submissionTracker';
import { titleFromSlug } from '../utils/slug';

export interface RocketPushButtonProps {
  currentSlug: string;
}

function extractEditorCode(): string {
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

export function RocketPushButton({ currentSlug }: RocketPushButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  async function handlePush(): Promise<void> {
    if (launching || !currentSlug) return;
    setLaunching(true);

    try {
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

      // 2. If code was extracted from the editor, save it to problem notes
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

      // Wait for the rocket to reach the top
      await new Promise((r) => setTimeout(r, 1100));

      setLaunching(false);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 3500);
    } catch (err) {
      console.warn('[RecallLC] Could not push problem:', err);
      setLaunching(false);
    }
  }

  return (
    <>
      {/* Floating Rocket Launch Animation (flies from ground to top) */}
      {launching ? (
        <div className="rlc-flying-rocket-container" aria-hidden="true">
          <div className="rlc-flying-rocket">
            <span className="rlc-rocket-symbol">🚀</span>
            <span className="rlc-rocket-flame">🔥</span>
            <span className="rlc-rocket-smoke">💨</span>
          </div>
        </div>
      ) : null}

      {/* Success Notification Message */}
      {success ? (
        <div className="rlc-rocket-toast" role="status" aria-live="polite">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <p className="font-bold text-[12px] text-white">Successfully added to RecallLC!</p>
              <p className="text-[10px] text-purple-200">Problem & solution tracked for revision</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="ml-1 text-[11px] text-purple-300 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {/* Rocket Button with Tooltip */}
      <div
        className="rlc-rocket-wrapper"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {showTooltip && !launching && !success ? (
          <div className="rlc-rocket-tooltip" role="tooltip">
            <span>Push to RecallLC 🚀</span>
            <span className="rlc-rocket-tooltip-arrow" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handlePush()}
          disabled={launching}
          className={`rlc-rocket-btn ${success ? 'rlc-rocket-btn-success' : ''}`}
          title="Push this question to RecallLC 🚀"
          aria-label="Push this question to RecallLC 🚀"
        >
          {success ? (
            <span className="text-base font-bold text-emerald-300">✓</span>
          ) : (
            <span className="text-xl select-none leading-none">🚀</span>
          )}
        </button>
      </div>
    </>
  );
}
