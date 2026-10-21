import { useState } from 'react';

import { pushProblemToRecallLC } from './pushHelper';

export interface RocketPushButtonProps {
  currentSlug: string;
}

export function RocketPushButton({ currentSlug }: RocketPushButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  async function handlePush(): Promise<void> {
    if (launching || !currentSlug) return;
    setLaunching(true);

    try {
      await pushProblemToRecallLC(currentSlug);

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
