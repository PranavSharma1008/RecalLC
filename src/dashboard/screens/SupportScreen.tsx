import { useId, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { generateQrDataUrl } from '../../utils/qr';

/**
 * Razorpay & UPI Payment Configuration
 *
 * Edit these values with your actual Razorpay details from https://dashboard.razorpay.com:
 * 1. paymentLink: Create a Payment Page or Payment Link in Razorpay Dashboard and paste it here.
 * 2. upiId: Your UPI ID (from Google Pay, PhonePe, Paytm, or your Razorpay VPA).
 */
export const RAZORPAY_CONFIG = {
  // Replace with your Razorpay Payment Link / Page (e.g., https://rzp.io/l/your-page)
  paymentLink: 'https://rzp.io/l/recalllc',
  // Replace with your UPI ID
  upiId: 'pranavsharma@upi',
  developerName: 'Pranav Sharma',
};

export function SupportScreen() {
  const [coffeeSelected, setCoffeeSelected] = useState<boolean>(true);
  const [claudeSelected, setClaudeSelected] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  const customInputId = useId();
  const emailInputId = useId();
  const messageInputId = useId();

  const customVal = Number.parseFloat(customAmount) || 0;
  const currentAmount = (coffeeSelected ? 89 : 0) + (claudeSelected ? 2399 : 0) + (customVal > 0 ? customVal : 0);

  const upiId = RAZORPAY_CONFIG.upiId;
  const upiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    RAZORPAY_CONFIG.developerName,
  )}&am=${currentAmount}&cu=INR&tn=${encodeURIComponent(message || 'Support RecallLC extension')}`;
  const qrCodeUrl = generateQrDataUrl(upiDeepLink, 220);

  function handleCopyUpi(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  }

  function handlePayClick(): void {
    setShowPaymentModal(true);
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">Support my extensions</h1>
        <p className="mt-2 text-sm text-muted">They stay free either way. Pick whichever is easier for you.</p>
      </div>

      {/* Top 2 Option Cards (India / Outside India) */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* In India Card */}
        <div className="rlc-card flex flex-col justify-between p-6 transition-all hover:border-line-strong">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl font-bold text-fg border border-line">
                ₹
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">In India</p>
                <h2 className="text-lg font-bold text-fg">Razorpay / UPI</h2>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Pay once, in rupees.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg border border-line">
                ✓ One-time
              </span>
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg border border-line">
                ✓ In rupees (₹)
              </span>
            </div>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                document.getElementById('payment-details-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full rounded-xl bg-accent py-2.5 text-center text-xs font-semibold text-accent-contrast shadow-sm transition-all hover:bg-accent-hover"
            >
              Pay with Razorpay / UPI
            </button>
          </div>
        </div>

        {/* Outside India Card */}
        <div className="rlc-card flex flex-col justify-between p-6 transition-all hover:border-line-strong">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-xl text-fg border border-line">
                🐙
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Outside India</p>
                <h2 className="text-lg font-bold text-fg">GitHub Sponsors</h2>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Sponsor through GitHub, from any country.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg border border-line">
                ✓ Monthly or one-time
              </span>
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg border border-line">
                ✓ In US dollars ($)
              </span>
              <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg border border-line">
                ✓ Needs a GitHub account
              </span>
            </div>
          </div>
          <div className="mt-6">
            <a
              href="https://github.com/sponsors/PranavSharma1008"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl border border-line bg-surface-2 py-2.5 text-center text-xs font-semibold text-fg transition-all hover:border-line-strong hover:bg-surface-3"
            >
              Sponsor on GitHub
            </a>
          </div>
        </div>
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
              RecallLC is a 100% free, local-first browser extension designed to help software engineers never forget
              the LeetCode problems they solved. No cloud lock-in, no paywalls, and zero ads. Your contributions help
              cover development tools, testing devices, and ongoing maintenance.
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
              <strong className="text-fg">Pranav Sharma</strong>. They do not buy a product, licence or extra features.
              Contributions are non-refundable, except duplicate or mistaken payments: email{' '}
              <a href="mailto:pranav2410991479@gmail.com" className="text-accent underline">
                pranav2410991479@gmail.com
              </a>{' '}
              within 7 days and they will be refunded to the original payment method.
            </p>
            <p>
              You agree to share information entered on this page with Pranav Sharma and payment providers, adhering to
              applicable laws.
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

            {/* Email Field */}
            <div>
              <label htmlFor={emailInputId} className="block text-xs font-medium text-muted">
                Email <span className="text-danger">*</span>
              </label>
              <input
                id={emailInputId}
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rlc-input mt-1 text-xs"
                required
              />
            </div>

            {/* Message Field */}
            <div>
              <label htmlFor={messageInputId} className="block text-xs font-medium text-muted">
                A message for Pranav <span className="text-subtle">(optional)</span>
              </label>
              <input
                id={messageInputId}
                type="text"
                placeholder="Thanks for making RecallLC free!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rlc-input mt-1 text-xs"
              />
            </div>
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
                Pay ₹ {currentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Payment Modal with QR Code */}
      {showPaymentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rlc-card w-full max-w-md p-6 shadow-2xl">
            {paymentSuccess ? (
              <div className="text-center py-6 space-y-4">
                <span className="text-5xl">🎉</span>
                <h3 className="text-xl font-bold text-fg">Thank You for Your Support!</h3>
                <p className="text-xs text-muted">
                  Your contribution helps keep RecallLC free, open, and private for developers everywhere.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setPaymentSuccess(false);
                      setShowPaymentModal(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="text-base font-bold text-fg">Pay via UPI / QR Code</h3>
                    <p className="text-xs text-muted">Recipient: Pranav Sharma</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="text-subtle hover:text-fg text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Amount to pay */}
                <div className="rounded-xl bg-accent-soft p-3 text-center border border-accent/30">
                  <p className="text-[11px] text-accent uppercase font-semibold tracking-wider">Amount to pay</p>
                  <p className="text-2xl font-bold text-fg mt-0.5">
                    ₹ {currentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Razorpay Gateway Direct Button */}
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-3.5 text-center">
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-wide">Razorpay Gateway</p>
                  <p className="text-xs text-muted mt-0.5">Supports Credit/Debit Cards, NetBanking, and UPI</p>
                  <a
                    href={RAZORPAY_CONFIG.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 text-xs font-bold text-accent-contrast shadow-sm hover:bg-accent-hover transition-all"
                  >
                    <span>💳</span> Pay via Razorpay Link ↗
                  </a>
                </div>

                <div className="flex items-center gap-2 text-[10px] uppercase font-semibold text-subtle">
                  <div className="h-px flex-1 bg-line" />
                  <span>or scan UPI QR code</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                {/* Live UPI QR Code */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white p-4">
                  <img
                    src={qrCodeUrl}
                    alt="UPI Payment QR Code"
                    className="h-44 w-44 object-contain"
                    onError={(e) => {
                      // Fallback if network is offline
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <p className="mt-2 text-[10px] font-semibold text-gray-800">
                    Scan with any UPI App: GPay, PhonePe, Paytm, BHIM
                  </p>
                </div>

                {/* UPI ID with copy */}
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-subtle font-semibold">UPI ID</p>
                    <p className="text-xs font-mono font-bold text-fg">{upiId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-semibold text-fg hover:bg-line-strong transition-colors"
                  >
                    {copiedUpi ? '✓ Copied!' : 'Copy UPI'}
                  </button>
                </div>

                {/* Direct App Launch Links */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={upiDeepLink}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 py-2 text-xs font-semibold text-fg hover:border-line-strong"
                  >
                    <span>📱</span> Open in UPI App
                  </a>
                  <button
                    type="button"
                    onClick={() => setPaymentSuccess(true)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <span>✓</span> I Have Paid
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
