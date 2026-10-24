import { useEffect, useId, useState } from 'react';

/**
 * Razorpay Payment Configuration
 *
 * Configured for Razorpay Standard Checkout in Live Production mode:
 * - checkoutUrl: Target website running the Razorpay Standard Checkout.
 * - developerName: Name displayed on payment invoices.
 */
export const RAZORPAY_CONFIG = {
  checkoutUrl: 'http://localhost:3000',
  developerName: 'Pranav Sharma',
};

export function SupportScreen() {
  const [selectedGateway, setSelectedGateway] = useState<'razorpay' | 'github' | null>(null);
  const [coffeeSelected, setCoffeeSelected] = useState<boolean>(true);
  const [claudeSelected, setClaudeSelected] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [thankYouInfo, setThankYouInfo] = useState<{
    paymentId?: string;
    amount?: number;
  } | null>(null);

  const customInputId = useId();

  const customVal = Number.parseFloat(customAmount) || 0;
  const currentAmount = (coffeeSelected ? 89 : 0) + (claudeSelected ? 2399 : 0) + (customVal > 0 ? customVal : 0);

  // Dismiss modal on Escape key press
  useEffect(() => {
    if (!showPaymentModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowPaymentModal(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPaymentModal]);

  // Listen for payment events from embedded checkout iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'PAYMENT_SUCCESS') {
        // Close modal immediately and return to previous page with thank-you message
        setShowPaymentModal(false);
        setThankYouInfo({
          paymentId: event.data.payment_id,
          amount: event.data.amount || currentAmount,
        });
      } else if (event.data?.type === 'PAYMENT_CANCELLED' || event.data?.type === 'PAYMENT_REDIRECT') {
        setShowPaymentModal(false);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentAmount]);

  // Thank-you message remains on screen for 8 seconds
  useEffect(() => {
    if (!thankYouInfo) return;
    const timer = setTimeout(() => {
      setThankYouInfo(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [thankYouInfo]);

  function handlePayClick(): void {
    setShowPaymentModal(true);
  }

  return (
    <div className="space-y-10">
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* Thankful Message Banner from Pranav Sharma (8 seconds with cross button) */}
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
                  Thank you so much for your generous contribution of{' '}
                  <strong className="text-fg font-semibold">
                    ₹
                    {(thankYouInfo.amount || currentAmount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
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
                  . Your support keeps RecallLC completely free, private, and continuously updated for developers
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

          {/* 8-second progress indicator bar */}
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

      {/* Navigation between Payment Options List and Details Page */}
      {selectedGateway === null ? (
        <>
          {/* Page Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">Support my Free Extensions</h1>
              <span className="text-3xl sm:text-4xl">☕</span>
            </div>
            <div className="mx-auto mt-2.5 h-1 w-14 rounded-full bg-accent" />
            <p className="mt-3 text-sm text-muted max-w-xl mx-auto">
              They stay free either way. Pick whichever payment method is easier for you.
            </p>
          </div>

          {/* Top 2 Option Cards (India / Outside India) */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* In India Card */}
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
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider">In India</p>
                  <h2 className="text-xl font-bold text-fg">Razorpay</h2>
                </div>
                <p className="text-xs text-muted">Pay once, in rupees (UPI, Cards, NetBanking).</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                    <span className="text-accent font-bold">✓</span> One-time
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                    <span className="text-accent font-bold">✓</span> In rupees (₹)
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGateway('razorpay')}
                  className="w-full rounded-xl py-3 text-center text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-[0.99] bg-accent text-accent-contrast hover:bg-accent-hover hover:shadow-lg"
                >
                  <span>Pay with Razorpay</span>
                  <span className="text-[10px] font-semibold">→</span>
                </button>
              </div>
            </div>

            {/* Outside India Card */}
            <div className="rlc-card flex flex-col justify-between p-6 sm:p-7 rounded-2xl transition-all border-line hover:border-line-strong hover:shadow-md">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-fg border border-line shadow-inner">
                    <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  </div>
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted border border-line uppercase tracking-wider">
                    GitHub
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Outside India</p>
                  <h2 className="text-xl font-bold text-fg">GitHub Sponsors</h2>
                </div>
                <p className="text-xs text-muted">Sponsor through GitHub, from any country.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                    <span className="text-accent font-bold">✓</span> Monthly or one-time
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                    <span className="text-accent font-bold">✓</span> In US dollars ($)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted border border-line">
                    <span className="text-accent font-bold">✓</span> Needs a GitHub account
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-2">
                <a
                  href="https://github.com/sponsors/PranavSharma1008"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl border border-line bg-surface-2 py-3 text-center text-xs font-bold text-fg transition-all hover:border-line-strong hover:bg-surface-3 active:scale-[0.99] shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>Sponsor on GitHub</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Revealed Razorpay Details Form (Next Page - Top 2 Cards Removed!) */
        <div
          id="payment-details-section"
          className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center justify-between border-b border-line pb-4">
            <button
              type="button"
              onClick={() => setSelectedGateway(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-fg hover:border-line-strong hover:bg-surface-3 transition-all cursor-pointer shadow-sm"
            >
              <span>←</span>
              <span>Back to all payment options</span>
            </button>
          </div>

          {/* Main Two-Column Layout */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column: About & Contact */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-fg">Support my Free Extensions</h2>
                  <span className="text-2xl">☕</span>
                </div>
                <div className="mt-2 h-1 w-14 rounded-full bg-accent" />
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  RecallLC is a 100% free, local-first browser extension designed to help software engineers never
                  forget the LeetCode problems they solved. No cloud lock-in, no paywalls, and zero ads. Your
                  contributions help cover development tools, testing devices, and ongoing maintenance.
                </p>
              </div>

              {/* Contact Details */}
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs font-bold text-fg">Contact Us:</p>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <span>✉️</span>
                    <a
                      href="mailto:pranav2410991479@gmail.com"
                      className="font-medium text-accent hover:underline hover:text-accent-hover"
                    >
                      pranav2410991479@gmail.com
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span>💼</span>
                    <a
                      href="https://www.linkedin.com/in/pranavsharma1008/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:underline hover:text-accent-hover flex items-center gap-1"
                    >
                      linkedin.com/in/pranavsharma1008 ↗
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span>🐙</span>
                    <a
                      href="https://github.com/sponsors/PranavSharma1008"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:underline hover:text-accent-hover flex items-center gap-1"
                    >
                      github.com/sponsors/PranavSharma1008 ↗
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <span>👤</span>
                    <span className="text-fg font-medium">Developer: Pranav Sharma</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line">
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=pranav2410991479@gmail.com&su=RecallLC%20Enquiry"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-contrast shadow-sm hover:bg-accent-hover transition-all cursor-pointer"
                  >
                    <span>📧</span>
                    <span>Open in Gmail (pranav2410991479@gmail.com)</span>
                  </a>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-3 text-[11px] leading-relaxed text-subtle">
                <p className="font-semibold text-muted">Terms & Conditions:</p>
                <p>
                  Payments on this page are voluntary contributions to support free browser extensions by{' '}
                  <strong className="text-fg">Pranav Sharma</strong>. They do not buy a product, licence or extra
                  features. Contributions are non-refundable, except duplicate or mistaken payments: email{' '}
                  <a href="mailto:pranav2410991479@gmail.com" className="text-accent underline">
                    pranav2410991479@gmail.com
                  </a>{' '}
                  within 7 days and they will be refunded to the original payment method.
                </p>
                <p>
                  You agree to share information entered on this page with Pranav Sharma and payment providers, adhering
                  to applicable laws.
                </p>
              </div>
            </div>

            {/* Right Column: Payment Details Card */}
            <div id="payment-details-card" className="rlc-card p-6 shadow-md">
              <div className="border-b border-line pb-4">
                <h2 className="text-xl font-bold tracking-tight text-fg">Payment Details</h2>
                <div className="mt-2 h-1 w-12 rounded-full bg-accent" />
              </div>

              <div className="mt-5 space-y-4">
                {/* Custom Amount */}
                <div>
                  <label htmlFor={customInputId} className="block text-xs font-medium text-muted">
                    Custom Amount
                  </label>
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-muted">
                      ₹
                    </span>
                    <input
                      id={customInputId}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Enter Amount"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className={`rlc-input pl-7 text-xs ${customVal > 0 ? 'border-accent ring-1 ring-accent' : ''}`}
                    />
                  </div>
                </div>

                {/* Coffee Option: ₹89.00 */}
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                    coffeeSelected
                      ? 'border-accent bg-accent-soft text-fg'
                      : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">☕</span>
                    <span className="text-xs font-semibold text-fg">Coffee for Pranav</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-fg">₹ 89.00</span>
                    <input
                      type="checkbox"
                      name="coffee"
                      checked={coffeeSelected}
                      onChange={(e) => setCoffeeSelected(e.target.checked)}
                      className="h-4 w-4 rounded accent-accent cursor-pointer"
                    />
                  </div>
                </label>

                {/* Claude Pro Option: ₹2,399.00 */}
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                    claudeSelected
                      ? 'border-accent bg-accent-soft text-fg'
                      : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⚡</span>
                    <span className="text-xs font-semibold text-fg">Claude Pro for Pranav</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-fg">₹ 2,399.00</span>
                    <input
                      type="checkbox"
                      name="claude"
                      checked={claudeSelected}
                      onChange={(e) => setClaudeSelected(e.target.checked)}
                      className="h-4 w-4 rounded accent-accent cursor-pointer"
                    />
                  </div>
                </label>
              </div>

              {/* Payment Badges & Action Button */}
              <div className="mt-6 border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center text-xs text-subtle">
                    <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted border border-line">
                      🔒 PCI Compliant & Secure
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePayClick}
                    disabled={currentAmount <= 0}
                    className="rounded-xl bg-accent px-6 py-2.5 text-xs font-bold text-accent-contrast shadow-md transition-all hover:bg-accent-hover disabled:opacity-50"
                  >
                    Pay ₹{' '}
                    {currentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Mode Razorpay Gateway Overlay on Same Page (Clean full-bleed, no top bar) */}
      {showPaymentModal ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0e14] animate-in fade-in duration-150">
          {/* Floating Back Button */}
          <button
            type="button"
            onClick={() => setShowPaymentModal(false)}
            className="absolute top-3 left-4 z-50 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface-1/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-fg hover:bg-surface-2 transition-all cursor-pointer shadow-lg"
            title="Return to options"
          >
            <span>← Back</span>
          </button>

          {/* Floating Close Button */}
          <button
            type="button"
            onClick={() => setShowPaymentModal(false)}
            className="absolute top-3 right-4 z-50 rounded-lg p-2 text-subtle hover:text-fg bg-surface-1/90 backdrop-blur-md hover:bg-surface-2 transition-all text-sm cursor-pointer border border-white/10 shadow-lg"
            aria-label="Close modal"
          >
            ✕
          </button>

          {/* 100% Full-bleed iframe Area */}
          <div className="relative w-full h-full flex-1 overflow-hidden bg-[#0b0e14]">
            <iframe
              src={`${RAZORPAY_CONFIG.checkoutUrl}/checkout.html?amount=${currentAmount}`}
              className="w-full h-full border-0"
              allow="payment *"
              title="Razorpay Secure Checkout"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
