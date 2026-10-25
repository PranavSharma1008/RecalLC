import { useEffect, useState } from 'react';

/**
 * Razorpay Payment Configuration
 *
 * Configured for direct Razorpay contribution page:
 * - paymentPageUrl: Direct Razorpay payment link (https://razorpay.me/@recallc).
 * - developerName: Name displayed on payment invoices.
 */
export const RAZORPAY_CONFIG = {
  checkoutUrl: 'https://razorpay.me/@recallc',
  paymentPageUrl: 'https://razorpay.me/@recallc',
  developerName: 'Pranav Sharma',
};

export function SupportScreen() {
  const [thankYouInfo, setThankYouInfo] = useState<{
    paymentId?: string;
    amount?: number;
  } | null>(null);

  // Listen for payment events from payment gateway or external checkout
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'PAYMENT_SUCCESS') {
        const rawPaymentId = event.data.payment_id;
        const paymentId =
          typeof rawPaymentId === 'string' ? rawPaymentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) : undefined;

        const rawAmount = event.data.amount;
        const amount =
          typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : undefined;

        setThankYouInfo({
          paymentId,
          amount,
        });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Thank-you message remains on screen for 8 seconds
  useEffect(() => {
    if (!thankYouInfo) return;
    const timer = setTimeout(() => {
      setThankYouInfo(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [thankYouInfo]);

  return (
    <div className="space-y-10">
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* Thankful Message Banner from Pranav Sharma */}
      {thankYouInfo ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-surface-2 to-surface-2 p-5 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-2xl border border-emerald-500/40 text-emerald-400 shadow-inner">
                💖
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-fg">A heartfelt thank you from Pranav Sharma!</h3>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                    Contribution Received
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Thank you so much for your generous contribution
                  {thankYouInfo.amount ? (
                    <>
                      {' '}
                      of{' '}
                      <strong className="text-fg font-semibold">
                        ₹
                        {thankYouInfo.amount.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </>
                  ) : null}
                  {thankYouInfo.paymentId ? (
                    <>
                      {' '}
                      (Payment ID:{' '}
                      <code className="text-fg font-mono text-[11px] bg-white/10 px-1.5 py-0.5 rounded">
                        {thankYouInfo.paymentId}
                      </code>
                      )
                    </>
                  ) : null}
                  . Your support keeps RecalLC completely free, private, and continuously updated for developers
                  everywhere!
                </p>
                <p className="text-[11px] text-accent font-medium pt-1">
                  Wishing you the best on your LeetCode problem-solving journey! 🚀
                </p>
              </div>
            </div>

            {/* Cross Button to dismiss immediately */}
            <button
              type="button"
              onClick={() => setThankYouInfo(null)}
              className="rounded-lg p-1.5 text-muted hover:text-fg hover:bg-surface-3 transition-colors text-base cursor-pointer shrink-0"
              aria-label="Dismiss message"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
            <div
              className="h-full bg-emerald-400/80"
              style={{
                animation: 'shrinkWidth 8s linear forwards',
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Page Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">Support my Free Extensions</h1>
          <span className="text-3xl sm:text-4xl">☕</span>
        </div>
        <div className="mx-auto mt-2.5 h-1 w-14 rounded-full bg-accent" />
        <p className="mt-3 text-sm text-muted max-w-xl mx-auto leading-relaxed">
          RecalLC is 100% free, private, and open-source. If it helps you master DSA patterns and ace your technical
          interviews, consider fueling its continuous development!
        </p>
      </div>

      {/* Centered Razorpay Option Card */}
      <div className="mx-auto w-full max-w-md">
        <div className="rlc-card flex flex-col justify-between p-6 sm:p-7 rounded-2xl transition-all border-line hover:border-accent/40 hover:shadow-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent text-xl font-bold border border-accent/30 shadow-inner">
                ₹
              </div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent border border-accent/30 uppercase tracking-wider">
                Razorpay
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Contribution</p>
              <h2 className="text-xl font-bold text-fg">Support via Razorpay</h2>
            </div>
            <p className="text-xs text-muted">Pay once via UPI (GPay, PhonePe, Paytm), Cards, or NetBanking.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                <span className="text-accent font-bold">✓</span> One-time
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                <span className="text-accent font-bold">✓</span> In rupees (₹)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                <span className="text-accent font-bold">✓</span> Fast & Secure
              </span>
            </div>
          </div>
          <div className="mt-6 pt-2">
            <a
              href="https://razorpay.me/@recallc"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-xl py-3 text-center text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] bg-accent text-accent-contrast hover:bg-accent-hover hover:shadow-lg"
            >
              <span>Pay with Razorpay</span>
              <span className="text-[10px] font-semibold">↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Why Support & Community Impact Section */}
      <div className="rlc-card rounded-2xl p-6 sm:p-8 border-line space-y-6 transition-all hover:border-accent/30">
        <div className="text-center space-y-1.5 max-w-xl mx-auto">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent border border-accent/30 uppercase tracking-wider">
            Why Support?
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-fg pt-1">Built by a Developer, for Developers</h2>
          <p className="text-xs sm:text-sm text-muted">
            RecalLC was created to solve the hardest part of LeetCode: actually remembering patterns when interview day
            arrives.
          </p>
        </div>

        {/* 3 Value Pillars */}
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="rounded-xl border border-line bg-surface-2 p-5 space-y-2 transition-colors hover:border-accent/40">
            <div className="text-2xl">🛡️</div>
            <h3 className="text-sm font-bold text-fg">Always 100% Free & Private</h3>
            <p className="text-xs text-muted leading-relaxed">
              No subscriptions, no paywalls, and zero telemetry. Your notes and revision schedules stay safely stored on
              your local device.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-5 space-y-2 transition-colors hover:border-accent/40">
            <div className="text-2xl">⚡</div>
            <h3 className="text-sm font-bold text-fg">Active & Independent</h3>
            <p className="text-xs text-muted leading-relaxed">
              Continuous feature enhancements, algorithm tuning (SM-2 spaced repetition), and instant patches when
              LeetCode updates its interface.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-5 space-y-2 transition-colors hover:border-accent/40">
            <div className="text-2xl">☕</div>
            <h3 className="text-sm font-bold text-fg">Fuel Late-Night Coding</h3>
            <p className="text-xs text-muted leading-relaxed">
              Your support powers the late-night coffee and dedicated hours needed to build, polish, and maintain free
              software for the community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
