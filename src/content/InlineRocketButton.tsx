import { useEffect, useState } from 'react';

import { pushProblemToRecallLC } from './pushHelper';
import { callService } from '../services/messaging';

export interface InlineRocketButtonProps {
  currentSlug: string;
  autoOpen?: boolean;
}

export function InlineRocketButton({ currentSlug, autoOpen = false }: InlineRocketButtonProps) {
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(autoOpen);
  const [showTooltip, setShowTooltip] = useState(false);
  const isGfg = typeof window !== 'undefined' && window.location.hostname.includes('geeksforgeeks.org');

  useEffect(() => {
    if (autoOpen) {
      setSuccess(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    let active = true;
    if (currentSlug) {
      callService('get-problem', { slug: currentSlug })
        .then((res) => {
          if (active && res?.problem) {
            setSuccess(true);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [currentSlug]);

  async function handlePush(event: React.MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !currentSlug) return;
    setBusy(true);
    setLaunching(true);

    try {
      await pushProblemToRecallLC(currentSlug);

      // Rocket flight animation
      await new Promise((r) => setTimeout(r, 900));

      setLaunching(false);
      setBusy(false);
      setSuccess(true);
    } catch (err) {
      console.warn('[RecallLC] Could not push problem:', err);
      setLaunching(false);
      setBusy(false);
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

      {/* Top bar inline cluster: seamless rocket button */}
      <div
        className="rlc-topbar-rocket-container"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '28px',
          marginLeft: isGfg ? '10px' : '3px',
          marginRight: isGfg ? '18px' : '2px',
        }}
      >
        {/* Rocket button wrapper with tooltip */}
        <div
          className="rlc-inline-rocket-wrapper"
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
          }}
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
              background: success ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              border: success ? '1px solid rgba(52, 211, 153, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: success ? '0 0 8px rgba(16, 185, 129, 0.25)' : 'none',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: busy ? 'wait' : 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              verticalAlign: 'middle',
              margin: 0,
              transition: 'all 0.15s ease-in-out',
            }}
            title={success ? 'Added to RecallLC' : 'Push to RecallLC 🚀'}
            aria-label={success ? 'Added to RecallLC' : 'Push to RecallLC 🚀'}
          >
            {busy ? (
              <span
                className="rlc-inline-spin"
                style={{ display: 'inline-block', fontSize: '12px', lineHeight: 1, animation: 'rlc-spin 1s linear infinite' }}
              >
                ⏳
              </span>
            ) : success ? (
              <span
                className="rlc-inline-success-label"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', lineHeight: 1 }}
              >
                <span
                  className="rlc-inline-check"
                  style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', lineHeight: 1 }}
                >
                  ✓
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#a7f3d0', lineHeight: 1 }}>Added</span>
              </span>
            ) : (
              <span
                className="rlc-inline-rocket-icon"
                style={{ fontSize: '14px', userSelect: 'none', lineHeight: 1, display: 'inline-block' }}
              >
                🚀
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
