import { useEffect, useState } from 'react';

import { isExtensionContextValid, notifyContextInvalidated } from '../services/messaging';
import { pushProblemToRecallLC } from './pushHelper';

export interface RocketPushButtonProps {
  currentSlug: string;
}

export function RocketPushButton({ currentSlug }: RocketPushButtonProps) {
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    // Show tooltip briefly when rocket button appears on successful submit
    setShowTooltip(true);
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [currentSlug]);

  async function handlePush(): Promise<void> {
    if (launching || !currentSlug) return;
    setLaunching(true);

    try {
      const pushed = await pushProblemToRecallLC(currentSlug);
      if (!pushed) {
        setLaunching(false);
        return;
      }

      // Wait for the rocket to reach the top
      await new Promise((r) => setTimeout(r, 1100));

      setLaunching(false);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err: unknown) {
      if (
        !isExtensionContextValid() ||
        (err instanceof Error && err.message.includes('Extension context invalidated')) ||
        (typeof chrome !== 'undefined' && !chrome.runtime?.id)
      ) {
        notifyContextInvalidated();
      } else {
        console.debug?.('[RecallLC] Could not push problem:', err);
      }
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
