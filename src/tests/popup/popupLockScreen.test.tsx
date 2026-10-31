// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../popup/App';
import { writeSettings } from '../../services/storage';
import { generateSalt, hashPasscode, setSessionUnlocked } from '../../utils/security';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Popup LockScreen Authentication Guard', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setSessionUnlocked(false);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders LockScreen when securityAuthEnabled is true and session is locked', async () => {
    const salt = generateSalt();
    const hash = await hashPasscode('vault123', salt);

    await writeSettings({
      securityAuthEnabled: true,
      securityPasscodeHash: hash,
      securityPasscodeSalt: salt,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    // Must show locked screen
    expect(container.textContent).toContain('RecallLC is Locked');
    expect(container.textContent).toContain('Enter your Master Passcode to unlock');
    // Must NOT reveal due problems or stats while locked
    expect(container.textContent).not.toContain('DUE TODAY');

    // Enter correct passcode
    const input = container.querySelector<HTMLInputElement>('input#master-passcode');
    const form = container.querySelector<HTMLFormElement>('form');
    expect(input).not.toBeNull();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'vault123');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Should now be unlocked and render popup main interface
    expect(container.textContent).not.toContain('RecallLC is Locked');
    expect(container.textContent).toContain('RecallLC');
    expect(container.textContent).toContain('Due today');
  });

  it('renders normal view immediately when securityAuthEnabled is false', async () => {
    await writeSettings({
      securityAuthEnabled: false,
      securityPasscodeHash: null,
      securityPasscodeSalt: null,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).not.toContain('RecallLC is Locked');
    expect(container.textContent).toContain('RecallLC');
    expect(container.textContent).toContain('Due today');

    // Verify Report an Issue button opens Gmail to pranav2410991479@gmail.com in new tab
    const issueLink = container.querySelector<HTMLAnchorElement>('a[href*="mail.google.com/mail"]');
    expect(issueLink).not.toBeNull();
    expect(issueLink?.textContent).toContain('Report an Issue');
    expect(issueLink?.href).toContain('pranav2410991479@gmail.com');
    expect(issueLink?.target).toBe('_blank');

    // Verify Review button
    const reviewLink = container.querySelector<HTMLAnchorElement>('a[href*="chromewebstore.google.com"]');
    expect(reviewLink).not.toBeNull();
    expect(reviewLink?.textContent).toContain('Review');
    expect(reviewLink?.href).toBe(
      'https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo',
    );
    expect(reviewLink?.target).toBe('_blank');
  });
});
