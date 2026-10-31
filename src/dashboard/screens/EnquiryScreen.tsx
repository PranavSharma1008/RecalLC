import { Button } from '../../components/ui/Button';
import { DIRECT_GMAIL_URL, ENQUIRY_TARGET_EMAIL } from '../../services/enquiry';

export interface EnquiryScreenProps {
  navigate: (path: string) => void;
}

export function EnquiryScreen({ navigate }: EnquiryScreenProps) {
  return (
    <div className="mx-auto max-w-xl py-12 px-4 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-3xl">
        ✉️
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Direct Enquiry & Support</h1>
        <p className="mt-2 text-sm text-muted">
          Need help, found an issue, or have a question? Send an email directly to developer{' '}
          <strong className="text-fg">Pranav Sharma</strong> at{' '}
          <span className="font-mono font-semibold text-accent">{ENQUIRY_TARGET_EMAIL}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm space-y-4">
        <a
          href={DIRECT_GMAIL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast shadow-md hover:bg-accent-hover transition-all cursor-pointer"
        >
          <span>📧</span>
          <span>Open in Gmail ({ENQUIRY_TARGET_EMAIL})</span>
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <a
            href="https://github.com/PranavSharma1008/RecalLC/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-fg hover:border-line-strong hover:bg-surface-3 transition-all cursor-pointer"
          >
            <span>🐛</span>
            <span>Report an Issue (GitHub)</span>
          </a>

          <a
            href="https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-400 hover:border-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all cursor-pointer"
          >
            <span>⭐</span>
            <span>Review on Web Store</span>
          </a>
        </div>

        <p className="text-xs text-subtle">
          Clicking above directly opens the Gmail compose window with recipient set to {ENQUIRY_TARGET_EMAIL}, or opens
          GitHub to report an issue or Chrome Web Store to leave a review.
        </p>
      </div>

      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Back to Overview
        </Button>
      </div>
    </div>
  );
}
