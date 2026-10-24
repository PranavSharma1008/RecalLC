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
    expect(container.textContent).toContain('Complete Payment');

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
});
