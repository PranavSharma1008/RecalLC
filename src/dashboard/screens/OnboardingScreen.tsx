import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useSettings } from '../../hooks/useSettings';

export interface OnboardingScreenProps {
  navigate: (path: string) => void;
  onDone: () => void;
}

const STEPS = [
  {
    title: 'RecallLC remembers what you solved',
    body: 'RecallLC watches for the verdict LeetCode shows after you submit. Only a real submission is recorded — opening a problem never counts as an attempt, and nothing is ever marked "solved" on your behalf.',
  },
  {
    title: 'A nudge when something is due',
    body: 'When you open a new problem, a small card appears in the corner if an older problem is due for revision. Dismiss it or push it to tomorrow and your schedule stays exactly as it was.',
  },
  {
    title: 'Bring your history with you',
    body: 'Already solved a few hundred problems? Import your attempt history from a JSON or CSV export and RecallLC will build a schedule from the dates you actually solved them.',
  },
];

export function OnboardingScreen({ navigate, onDone }: OnboardingScreenProps) {
  const { update } = useSettings();
  const [step, setStep] = useState(0);

  async function finish(): Promise<void> {
    await update({ onboardingCompleted: true });
    onDone();
    navigate('/');
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-2.5">
        <img src="/icons/icon48.png" alt="RecallLC Logo" className="h-8 w-8 rounded-lg object-contain drop-shadow-sm" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Welcome to RecallLC</h1>
          <p className="text-[11px] text-subtle whitespace-nowrap">Solve it. Remember it. Master it.</p>
        </div>
      </div>

      <Card>
        <div className="space-y-4 p-6">
          <div className="flex gap-1.5">
            {STEPS.map((_, index) => (
              <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-surface-3'}`} />
            ))}
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1.5 text-base font-semibold text-fg">{STEPS[step]!.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{STEPS[step]!.body}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => void finish()}>
                Skip
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" size="sm" onClick={() => setStep((value) => value + 1)}>
                  Next
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => void finish()}>
                  Get started
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-center text-[11px] text-subtle">
        Everything stays on this device. No account, no telemetry, no cloud.
      </p>
    </div>
  );
}
