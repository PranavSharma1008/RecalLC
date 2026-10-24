// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { SupportScreen } from '../../dashboard/screens/SupportScreen';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SupportScreen', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders both Razorpay and GitHub Sponsors option cards with direct external links opening in new tabs', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Check main title
    expect(container.textContent).toContain('Support my Free Extensions');

    // Razorpay Card
    expect(container.textContent).toContain('In India');
    expect(container.textContent).toContain('Razorpay');
    expect(container.textContent).toContain('Pay once, in rupees (UPI, Cards, NetBanking).');

    const razorpayLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Pay with Razorpay'),
    );
    expect(razorpayLink).toBeDefined();
    expect(razorpayLink?.getAttribute('href')).toBe('https://razorpay.me/@recallc');
    expect(razorpayLink?.getAttribute('target')).toBe('_blank');
    expect(razorpayLink?.getAttribute('rel')).toBe('noopener noreferrer');

    // GitHub Sponsors Card
    expect(container.textContent).toContain('Outside India');
    expect(container.textContent).toContain('GitHub Sponsors');
    expect(container.textContent).toContain('Sponsor through GitHub, from any country.');

    const githubLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Sponsor on GitHub'),
    );
    expect(githubLink).toBeDefined();
    expect(githubLink?.getAttribute('href')).toBe('https://github.com/sponsors/PranavSharma1008');
    expect(githubLink?.getAttribute('target')).toBe('_blank');
    expect(githubLink?.getAttribute('rel')).toBe('noopener noreferrer');

    // Does not render bottom contact/terms section
    expect(container.textContent).not.toContain('Terms & Conditions:');
    expect(container.textContent).not.toContain('Open in Gmail');

    await act(async () => {
      root.unmount();
    });
  });

  it('displays thankful message banner from Pranav Sharma upon receiving PAYMENT_SUCCESS and dismisses with cross button', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Simulate PAYMENT_SUCCESS event
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'PAYMENT_SUCCESS',
            payment_id: 'pay_test_thankyou_999',
            amount: 89,
          },
        }),
      );
    });

    // The thankful message banner from Pranav Sharma should appear on screen
    expect(container.textContent).toContain('A heartfelt thank you from Pranav Sharma!');
    expect(container.textContent).toContain('₹89.00');
    expect(container.textContent).toContain('pay_test_thankyou_999');

    // Find the cross button (✕) to dismiss
    const dismissBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss message"]');
    expect(dismissBtn).not.toBeNull();

    await act(async () => {
      dismissBtn?.click();
    });

    // The thankful message should be dismissed
    expect(container.textContent).not.toContain('A heartfelt thank you from Pranav Sharma!');

    await act(async () => {
      root.unmount();
    });
  });
});
