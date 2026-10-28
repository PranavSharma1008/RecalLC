import { useEffect, useState } from 'react';

import { pushProblemToRecallLC } from './pushHelper';

export interface InlineRocketButtonProps {
  currentSlug: string;
  autoOpen?: boolean;
  autoLaunch?: boolean;
  onPushed?: () => void;
}

let activeRocketElement: HTMLDivElement | null = null;
let rocketTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Triggers the flying rocket launch animation across the full screen.
 * Guaranteed to mount directly into document.body with fixed maximum z-index,
 * flying from bottom: 28px, left: 50% all the way up through the middle of the screen.
 */
export function triggerFlyingRocketAnimation(): void {
  if (typeof document === 'undefined' || !document.body) return;

  if (activeRocketElement && activeRocketElement.isConnected) {
    activeRocketElement.remove();
  }
  if (rocketTimer) {
    clearTimeout(rocketTimer);
  }

  const container = document.createElement('div');
  container.className = 'rlc-flying-rocket-container';
  container.setAttribute('aria-hidden', 'true');
  container.style.setProperty('position', 'fixed', 'important');
  container.style.setProperty('bottom', '28px', 'important');
  container.style.setProperty('left', '50%', 'important');
  container.style.setProperty('transform', 'translateX(-50%)', 'important');
  container.style.setProperty('z-index', '2147483647', 'important');
  container.style.setProperty('pointer-events', 'none', 'important');
  container.style.setProperty('display', 'flex', 'important');
  container.style.setProperty('flex-direction', 'column', 'important');
  container.style.setProperty('align-items', 'center', 'important');

  container.innerHTML = `
    <div class="rlc-flying-rocket" style="display:flex!important;flex-direction:column!important;align-items:center!important;animation:rlc-rocket-fly 1.1s cubic-bezier(0.25, 1, 0.5, 1) forwards!important;">
      <span class="rlc-rocket-symbol" style="font-size:48px!important;line-height:1!important;filter:drop-shadow(0 0 18px rgba(168, 85, 247, 0.95)) drop-shadow(0 0 32px rgba(52, 211, 153, 0.8))!important;">🚀</span>
      <span class="rlc-rocket-flame" style="font-size:30px!important;line-height:1!important;margin-top:-6px!important;animation:rlc-flame-flicker 0.15s infinite alternate!important;">🔥</span>
      <span class="rlc-rocket-smoke" style="font-size:24px!important;line-height:1!important;margin-top:-6px!important;animation:rlc-smoke-trail 0.7s ease-out forwards!important;">💨</span>
    </div>
  `;

  document.body.appendChild(container);
  activeRocketElement = container;

  rocketTimer = setTimeout(() => {
    if (container.isConnected) {
      container.remove();
    }
    if (activeRocketElement === container) {
      activeRocketElement = null;
    }
  }, 1150);
}

export function InlineRocketButton({
  currentSlug,
  autoOpen = false,
  autoLaunch = false,
  onPushed,
}: InlineRocketButtonProps) {
  const [busy, setBusy] = useState(false);
  const [, setLaunching] = useState(autoLaunch);
  const [success, setSuccess] = useState(!autoLaunch && autoOpen);
  const [showTooltip, setShowTooltip] = useState(false);
  const isGfg = typeof window !== 'undefined' && window.location.hostname.includes('geeksforgeeks.org');

  useEffect(() => {
    if (autoLaunch) {
      setLaunching(true);
      setSuccess(false);
      triggerFlyingRocketAnimation();
      const timer = setTimeout(() => {
        setLaunching(false);
        setSuccess(true);
        onPushed?.();
      }, 1100);
      return () => clearTimeout(timer);
    } else if (autoOpen) {
      setSuccess(true);
    }
  }, [autoLaunch, autoOpen, onPushed]);

  async function handlePush(event: React.MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !currentSlug) return;
    setBusy(true);
    setLaunching(true);
    triggerFlyingRocketAnimation();

    try {
      await pushProblemToRecallLC(currentSlug);

      // Rocket flight animation from ground to top (1.1s)
      await new Promise((r) => setTimeout(r, 1100));

      setLaunching(false);
      setBusy(false);
      setSuccess(true);
      onPushed?.();
    } catch (err) {
      console.warn('[RecallLC] Could not push problem:', err);
      setLaunching(false);
      setBusy(false);
    }
  }

  return (
    <>
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
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  lineHeight: 1,
                  animation: 'rlc-spin 1s linear infinite',
                }}
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
