// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LockScreen } from '../../components/LockScreen';
import { EnquiryScreen } from '../../dashboard/screens/EnquiryScreen';
import { generateSalt, hashPasscode, resetFailedAttempts, setSessionUnlocked } from '../../utils/security';
import { DIRECT_GMAIL_URL, ENQUIRY_TARGET_EMAIL } from '../../services/enquiry';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('LockScreen Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    resetFailedAttempts();
    setSessionUnlocked(false);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders locked state and rejects empty/incorrect passcode', async () => {
    const salt = generateSalt();
    const hash = await hashPasscode('secure123', salt);
    const onUnlock = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(<LockScreen passcodeHash={hash} passcodeSalt={salt} onUnlock={onUnlock} />);
    });

    expect(container.textContent).toContain('RecallLC is Locked');

    const input = container.querySelector<HTMLInputElement>('input#master-passcode');
    const form = container.querySelector<HTMLFormElement>('form');
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    const setReactInput = (val: string) => {
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Try empty submit
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain('Please enter your master passcode.');

    // Try wrong passcode
    await act(async () => {
      setReactInput('wrong123');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(container.textContent).toContain('Incorrect passcode');
    expect(onUnlock).not.toHaveBeenCalled();

    // Try correct passcode
    await act(async () => {
      setReactInput('secure123');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});

describe('EnquiryScreen Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders 1-click Gmail link targeting pranav2410991479@gmail.com', async () => {
    const navigate = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<EnquiryScreen navigate={navigate} />);
    });

    expect(container.textContent).toContain('Direct Enquiry & Support');
    expect(container.textContent).toContain('pranav2410991479@gmail.com');

    const gmailLink = container.querySelector<HTMLAnchorElement>('a[href*="mail.google.com"]');
    expect(gmailLink).not.toBeNull();
    expect(gmailLink?.href).toBe(DIRECT_GMAIL_URL);
    expect(gmailLink?.href).toContain(ENQUIRY_TARGET_EMAIL);
  });
});
