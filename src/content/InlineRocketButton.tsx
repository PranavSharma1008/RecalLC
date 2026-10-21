import { useState } from 'react';

import { pushProblemToRecallLC } from './pushHelper';

export interface InlineRocketButtonProps {
  currentSlug: string;
}

export function InlineRocketButton({ currentSlug }: InlineRocketButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  async function handlePush(event: React.MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (launching || !currentSlug) return;
    setLaunching(true);

    try {
      await pushProblemToRecallLC(currentSlug);

      // Wait for rocket animation to reach the top
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
      {/* Ground to top flying rocket animation */}
      {launching ? (
        <div className="rlc-flying-rocket-container" aria-hidden="true">
          <div className="rlc-flying-rocket">
            <span className="rlc-rocket-symbol">🚀</span>
            <span className="rlc-rocket-flame">🔥</span>
            <span className="rlc-rocket-smoke">💨</span>
          </div>
        </div>
      ) : null}

      {/* Floating success toast notification */}
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

      {/* Inline Rocket Button */}
      <div
        className="rlc-inline-rocket-wrapper"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {showTooltip && !launching && !success ? (
          <div className="rlc-inline-rocket-tooltip" role="tooltip">
            <span>Push to RecallLC 🚀</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={(e) => void handlePush(e)}
          disabled={launching}
          className={`rlc-inline-rocket-btn ${success ? 'rlc-inline-rocket-btn-success' : ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '32px',
            minWidth: '38px',
            padding: '0 10px',
            borderRadius: '8px',
            background: success
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
              : 'linear-gradient(135deg, #2e1065 0%, #170e30 100%)',
            border: success ? '1.5px solid #34d399' : '1.5px solid #a855f7',
            boxShadow: '0 2px 10px rgba(147, 51, 234, 0.45)',
            color: '#fff',
            fontSize: '16px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Push to RecallLC 🚀"
          aria-label="Push to RecallLC 🚀"
        >
          {success ? (
            <span className="text-sm font-bold text-emerald-300">✓</span>
          ) : (
            <span className="text-base select-none leading-none">🚀</span>
          )}
        </button>
      </div>
    </>
  );
}
