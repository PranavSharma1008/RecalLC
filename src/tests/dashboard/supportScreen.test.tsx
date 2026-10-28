// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  GITHUB_SPONSORS_CONFIG,
  PAYMENT_CONFIG,
  RAZORPAY_CONFIG,
  SupportScreen,
} from '../../dashboard/screens/SupportScreen';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SupportScreen', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders both payment options: Option 1 (Razorpay for India) and Option 2 (GitHub Sponsors for Outside India)', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Check main title
    expect(container.textContent).toContain('Support my Free Extensions');

    // 1. Razorpay Card (India)
    expect(container.textContent).toContain('Support via Razorpay');
    expect(container.textContent).toContain('Option 1 • For Supporters in India');
    expect(container.textContent).toContain('Pay once via UPI (GPay, PhonePe, Paytm)');

    const razorpayLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Pay with Razorpay'),
    );
    expect(razorpayLink).toBeDefined();
    expect(razorpayLink?.getAttribute('href')).toBe('https://razorpay.me/@recallc');
    expect(razorpayLink?.getAttribute('target')).toBe('_blank');
    expect(razorpayLink?.getAttribute('rel')).toBe('noopener noreferrer');

    // 2. GitHub Sponsors Card (Outside India)
    expect(container.textContent).toContain('Sponsor on GitHub');
    expect(container.textContent).toContain('Option 2 • Outside India (International)');
    expect(container.textContent).toContain('Outside India');
    expect(container.textContent).toContain('In Dollars ($ USD)');

    const sponsorsLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Sponsor on GitHub'),
    );
    expect(sponsorsLink).toBeDefined();
    expect(sponsorsLink?.getAttribute('href')).toBe('https://github.com/sponsors/PranavSharma1008');
    expect(sponsorsLink?.getAttribute('target')).toBe('_blank');
    expect(sponsorsLink?.getAttribute('rel')).toBe('noopener noreferrer');

    // Check exported config objects
    expect(RAZORPAY_CONFIG.paymentPageUrl).toBe('https://razorpay.me/@recallc');
    expect(GITHUB_SPONSORS_CONFIG.sponsorUrl).toBe('https://github.com/sponsors/PranavSharma1008');
    expect(GITHUB_SPONSORS_CONFIG.dashboardUrl).toBe('https://github.com/sponsors/PranavSharma1008/dashboard');
    expect(PAYMENT_CONFIG.razorpay).toBe(RAZORPAY_CONFIG);
    expect(PAYMENT_CONFIG.githubSponsors).toBe(GITHUB_SPONSORS_CONFIG);

    // Does not render bottom legacy clutter
    expect(container.textContent).not.toContain('Terms & Conditions:');
    expect(container.textContent).not.toContain('AULA F75');

    // Renders attractive value proposition and community impact content
    expect(container.textContent).toContain('Built by a Developer, for Developers');
    expect(container.textContent).toContain('Always 100% Free & Private');
    expect(container.textContent).toContain('Fuel Late-Night Coding');

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
