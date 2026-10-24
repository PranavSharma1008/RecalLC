// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { SupportScreen } from '../../dashboard/screens/SupportScreen';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SupportScreen checkboxes', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('allows selecting both Coffee and Claude Pro simultaneously', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // First select "Pay with Razorpay" to reveal payment options
    const razorpayBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pay with Razorpay'),
    );
    expect(razorpayBtn).toBeDefined();
    await act(async () => {
      razorpayBtn?.click();
    });

    const coffeeCheckbox = container.querySelector<HTMLInputElement>('input[name="coffee"]');
    const claudeCheckbox = container.querySelector<HTMLInputElement>('input[name="claude"]');
    expect(coffeeCheckbox).not.toBeNull();
    expect(claudeCheckbox).not.toBeNull();

    // Default: Coffee is checked (₹89.00), Claude is not checked
    expect(coffeeCheckbox?.checked).toBe(true);
    expect(claudeCheckbox?.checked).toBe(false);
    expect(container.textContent).toContain('Pay ₹ 89.00');

    // Select Claude Pro as well (both checked)
    await act(async () => {
      claudeCheckbox?.click();
    });

    expect(coffeeCheckbox?.checked).toBe(true);
    expect(claudeCheckbox?.checked).toBe(true);
    // 89 + 2399 = 2488
    expect(container.textContent).toContain('Pay ₹ 2,488.00');

    // Unselect Coffee (only Claude Pro checked)
    await act(async () => {
      coffeeCheckbox?.click();
    });

    expect(coffeeCheckbox?.checked).toBe(false);
    expect(claudeCheckbox?.checked).toBe(true);
    expect(container.textContent).toContain('Pay ₹ 2,399.00');

    // Enter custom amount
    const customInput = container.querySelector<HTMLInputElement>('input[type="number"]');
    expect(customInput).not.toBeNull();

    await act(async () => {
      if (customInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(customInput, '101');
        customInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // 2399 + 101 = 2500
    expect(container.textContent).toContain('Pay ₹ 2,500.00');

    await act(async () => {
      root.unmount();
    });
  });

  it('opens payment modal, renders Back buttons, and closes when Back button is clicked', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // First select "Pay with Razorpay" to reveal payment options
    const razorpayBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pay with Razorpay'),
    );
    expect(razorpayBtn).toBeDefined();
    await act(async () => {
      razorpayBtn?.click();
    });

    // Modal is initially not open
    expect(container.querySelector('.fixed.inset-0')).toBeNull();

    // Find and click the Pay button to open modal
    const payBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Pay ₹'));
    expect(payBtn).toBeDefined();

    await act(async () => {
      payBtn?.click();
    });

    // Modal is now open
    expect(container.querySelector('.fixed.inset-0')).not.toBeNull();
    expect(container.textContent).toContain('Razorpay Gateway');

    // Find the header "← Back" button
    const backButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('← Back'),
    );
    expect(backButtons.length).toBeGreaterThanOrEqual(1);

    // Click the top Back button to close modal
    await act(async () => {
      backButtons[0]?.click();
    });

    // Modal should now be closed
    expect(container.querySelector('.fixed.inset-0')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('displays thankful message from Pranav Sharma upon payment success and dismisses with cross button', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Simulate PAYMENT_SUCCESS event from iframe
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

  it('initially hides payment details until Razorpay option is selected', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SupportScreen />);
    });

    // Payment details are hidden by default
    expect(container.querySelector('#payment-details-section')).toBeNull();
    expect(container.querySelector('input[name="coffee"]')).toBeNull();

    // Click "Pay with Razorpay"
    const razorpayBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pay with Razorpay'),
    );
    await act(async () => {
      razorpayBtn?.click();
    });

    // Payment details are now visible
    expect(container.querySelector('#payment-details-section')).not.toBeNull();
    expect(container.querySelector('input[name="coffee"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
