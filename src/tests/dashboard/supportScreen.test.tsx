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

  it('renders centered Razorpay option card with direct external link opening in new tab and no GitHub Sponsors', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Check main title
    expect(container.textContent).toContain('Support my Free Extensions');

    // Razorpay Card (Centered)
    expect(container.textContent).toContain('Support via Razorpay');
    expect(container.textContent).toContain('Pay once via UPI (GPay, PhonePe, Paytm), Cards, or NetBanking.');

    const razorpayLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Pay with Razorpay'),
    );
    expect(razorpayLink).toBeDefined();
    expect(razorpayLink?.getAttribute('href')).toBe('https://razorpay.me/@recallc');
    expect(razorpayLink?.getAttribute('target')).toBe('_blank');
    expect(razorpayLink?.getAttribute('rel')).toBe('noopener noreferrer');

    // GitHub Sponsors is completely removed
    expect(container.textContent).not.toContain('GitHub Sponsors');
    expect(container.textContent).not.toContain('Outside India');
    expect(container.textContent).not.toContain('Sponsor on GitHub');
    expect(container.textContent).not.toContain('sponsors/PranavSharma1008');

    // Does not render bottom contact/terms section
    expect(container.textContent).not.toContain('Terms & Conditions:');
    expect(container.textContent).not.toContain('Open in Gmail');

    // Does not render any wishlist/requirements/gear boxes
    expect(container.textContent).not.toContain('Requirements');
    expect(container.textContent).not.toContain('AULA F75');

    // Renders attractive value proposition and community impact content
    expect(container.textContent).toContain('Built by a Developer, for Developers');
    expect(container.textContent).toContain('Always 100% Free & Private');
    expect(container.textContent).toContain('Fuel Late-Night Coding');
    expect(container.textContent).not.toContain('Landed an interview or job offer');

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
