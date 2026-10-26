import { useEffect, useState } from 'react';

import { callService } from '../services/messaging';
import { addLocalDays } from '../utils/date';
import { pushProblemToRecallLC } from './pushHelper';

export interface InlineRocketButtonProps {
  currentSlug: string;
  autoOpen?: boolean;
}

export function InlineRocketButton({ currentSlug, autoOpen = false }: InlineRocketButtonProps) {
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [ratedFeedback, setRatedFeedback] = useState<string | null>(null);
  const isGfg = typeof window !== 'undefined' && window.location.hostname.includes('geeksforgeeks.org');

  useEffect(() => {
    if (autoOpen && currentSlug) {
      void callService('get-problem', { slug: currentSlug }).then((existing) => {
        setIsRevision(Boolean(existing?.problem));
        setSuccess(true);
      });
    }
  }, [autoOpen, currentSlug]);

  async function handlePush(event: React.MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !currentSlug) return;
    setBusy(true);
    setLaunching(true);

    try {
      // Check if problem was already tracked before pushing attempt
      const existing = await callService('get-problem', { slug: currentSlug });
      const alreadyTracked = Boolean(existing?.problem);

      await pushProblemToRecallLC(currentSlug);

      // Rocket flight animation
      await new Promise((r) => setTimeout(r, 900));

      setLaunching(false);
      setBusy(false);
      setIsRevision(alreadyTracked);
      setSuccess(true);
      setRatedFeedback(null);

      // If it's a new problem, auto-dismiss after 2 seconds
      if (!alreadyTracked) {
        setTimeout(() => {
          setSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.warn('[RecallLC] Could not push problem:', err);
      setLaunching(false);
      setBusy(false);
    }
  }

  async function handleRescheduleDays(days: number): Promise<void> {
    if (!currentSlug) return;
    try {
      const targetDueAt = addLocalDays(Date.now(), days);
      await callService('reschedule', { slug: currentSlug, dueAt: targetDueAt });
      setRatedFeedback(`Rescheduled! Next revision in ${days} day${days === 1 ? '' : 's'}`);
      setTimeout(() => {
        setSuccess(false);
        setRatedFeedback(null);
      }, 2000);
    } catch (err) {
      console.warn('[RecallLC] Could not reschedule:', err);
    }
  }

  return (
    <>
      {/* Floating Rocket Launch Animation (flies up with flame & smoke) */}
      {launching ? (
        <div className="rlc-flying-rocket-container" aria-hidden="true">
          <div className="rlc-flying-rocket">
            <span className="rlc-rocket-symbol">🚀</span>
            <span className="rlc-rocket-flame">🔥</span>
            <span className="rlc-rocket-smoke">💨</span>
          </div>
        </div>
      ) : null}

      {/* Floating success / revision rating toast notification */}
      {success ? (
        <div className="rlc-rocket-toast" role="status" aria-live="polite">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none">🚀</span>
                <div>
                  <p className="font-bold text-[12px] text-white">
                    {ratedFeedback
                      ? `✓ ${ratedFeedback}`
                      : isRevision
                        ? 'Problem solved! Next revision reminder:'
                        : 'Successfully pushed to RecallLC!'}
                  </p>
                  <p className="text-[10px] text-purple-200">
                    {ratedFeedback
                      ? 'Next revision scheduled automatically'
                      : isRevision
                        ? 'Pick a schedule to set your next reminder date'
                        : 'Problem & solution saved for revision'}
                  </p>
                </div>
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

            {/* In-page Quick Revision Buttons */}
            {isRevision && !ratedFeedback ? (
              <div className="flex items-center gap-1.5 pt-1 border-t border-purple-500/30">
                <button
                  type="button"
                  onClick={() => void handleRescheduleDays(1)}
                  className="flex-1 rounded-md bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 py-1 px-1.5 text-[11px] font-semibold text-purple-200 transition-all cursor-pointer text-center"
                  title="Reschedule next review in 1 day"
                >
                  1 day
                </button>
                <button
                  type="button"
                  onClick={() => void handleRescheduleDays(3)}
                  className="flex-1 rounded-md bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 py-1 px-1.5 text-[11px] font-semibold text-amber-200 transition-all cursor-pointer text-center"
                  title="Reschedule next review in 3 days"
                >
                  3 days
                </button>
                <button
                  type="button"
                  onClick={() => void handleRescheduleDays(7)}
                  className="flex-1 rounded-md bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 py-1 px-1.5 text-[11px] font-semibold text-indigo-200 transition-all cursor-pointer text-center"
                  title="Reschedule next review in 7 days"
                >
                  7 days
                </button>
                <button
                  type="button"
                  onClick={() => void handleRescheduleDays(14)}
                  className="flex-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 py-1 px-1.5 text-[11px] font-semibold text-emerald-200 transition-all cursor-pointer text-center"
                  title="Reschedule next review in 14 days"
                >
                  14 days
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Top bar inline cluster: subtle vertical divider + compact rocket button */}
      <div
        className="rlc-topbar-rocket-container"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: '100%',
          marginRight: isGfg ? '18px' : undefined,
          marginLeft: isGfg ? '10px' : undefined,
        }}
      >
            {/* Subtle vertical separator matching LeetCode's top bar dividers (only on LeetCode) */}
            {!isGfg ? (
              <div
                className="rlc-topbar-divider"
                aria-hidden="true"
                style={{
                  width: '1px',
                  height: '14px',
                  backgroundColor: 'currentColor',
                  opacity: 0.25,
                  margin: '0 6px',
                  flexShrink: 0,
                }}
              />
            ) : null}

            {/* Rocket button wrapper with tooltip */}
            <div
              className="rlc-inline-rocket-wrapper"
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {showTooltip && !busy && !success ? (
                <div
                  className="rlc-inline-rocket-tooltip"
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    top: isGfg ? 'auto' : 'calc(100% + 6px)',
                    bottom: isGfg ? 'calc(100% + 8px)' : 'auto',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <span>Push to RecallLC 🚀</span>
                </div>
              ) : null}

          <button
            type="button"
            onClick={(e) => void handlePush(e)}
            disabled={busy}
            className={`rlc-inline-rocket-btn ${success ? 'rlc-inline-rocket-btn-success' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '28px',
              width: success ? 'auto' : '28px',
              minWidth: '28px',
              padding: success ? '0 8px' : '0',
              borderRadius: '6px',
              background: success ? 'rgba(16, 185, 129, 0.22)' : 'rgba(147, 51, 234, 0.16)',
              border: success ? '1px solid rgba(52, 211, 153, 0.7)' : '1px solid rgba(168, 85, 247, 0.45)',
              boxShadow: success ? '0 0 10px rgba(16, 185, 129, 0.35)' : '0 0 8px rgba(147, 51, 234, 0.25)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            title={success ? 'Added to RecallLC' : 'Push to RecallLC 🚀'}
            aria-label={success ? 'Added to RecallLC' : 'Push to RecallLC 🚀'}
          >
            {busy ? (
              <span className="text-xs animate-spin leading-none">⏳</span>
            ) : success ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-xs font-bold text-emerald-400">✓</span>
                <span className="text-[11px] font-semibold text-emerald-200">{ratedFeedback ? 'Rated' : 'Added'}</span>
              </span>
            ) : (
              <span className="text-sm select-none leading-none hover:scale-110 transition-transform">🚀</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
