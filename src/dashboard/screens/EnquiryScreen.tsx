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

        <p className="text-xs text-subtle">
          Clicking above directly opens the Gmail compose window with recipient set to {ENQUIRY_TARGET_EMAIL}.
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
