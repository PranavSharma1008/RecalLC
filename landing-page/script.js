/**
 * RecallLC Landing Page JavaScript
 * Interactions, mobile menu, clipboard helpers, and email draft generation.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initClipboardButtons();
  initContactForm();
  initRazorpayIntegration();
  updateDynamicYear();
});

/**
 * Mobile Navigation Toggle
 */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const siteHeader = document.querySelector('.site-header');

  if (!toggleBtn || !siteHeader) return;

  toggleBtn.addEventListener('click', () => {
    siteHeader.classList.toggle('mobile-menu-active');
    const isExpanded = siteHeader.classList.contains('mobile-menu-active');
    toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  });

  // Close menu when clicking outside or clicking any nav link
  document.addEventListener('click', (e) => {
    if (!siteHeader.contains(e.target)) {
      siteHeader.classList.remove('mobile-menu-active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      siteHeader.classList.remove('mobile-menu-active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Copy-to-Clipboard Buttons
 */
function initClipboardButtons() {
  const copyButtons = document.querySelectorAll('.btn-copy');

  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.getAttribute('data-copy') || btn.closest('.code-box')?.querySelector('code')?.innerText;
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy.trim());
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        btn.classList.add('copied');

        setTimeout(() => {
          btn.innerText = originalText;
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.warn('[RecallLC] Clipboard copy failed:', err);
      }
    });
  });
}

/**
 * Contact Form - Honest Mailto / Gmail Compose Handler
 * Avoids fake submission simulation by opening user's native email client with pre-filled content.
 */
function initContactForm() {
  const contactForm = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');

  if (!contactForm) return;

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('contact-name')?.value.trim() || 'Anonymous';
    const email = document.getElementById('contact-email')?.value.trim() || '';
    const subject = document.getElementById('contact-subject')?.value.trim() || 'RecallLC Enquiry';
    const message = document.getElementById('contact-message')?.value.trim() || '';

    const targetEmail = 'pranav2410991479@gmail.com';
    const bodyContent = `Hi Pranav,\n\n${message}\n\n---\nSender: ${name}\nEmail: ${email}`;

    // Mailto scheme
    const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(`[RecallLC] ${subject}`)}&body=${encodeURIComponent(bodyContent)}`;

    if (formFeedback) {
      formFeedback.innerHTML = `
        <div style="background: rgba(52, 211, 153, 0.12); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 0.9rem; color: #6ee7b7;">
          ✓ Opening your email client to send directly to <strong>${targetEmail}</strong>.<br/>
          If your client did not open automatically, <a href="${mailtoUrl}" style="text-decoration: underline; color: #fff; font-weight: 600;">click here to compose your email</a>.
        </div>
      `;
    }

    // Trigger email client
    window.location.href = mailtoUrl;
  });
}

/**
 * Razorpay Standard Web Checkout Integration
 *
 * Implements:
 * 1. POST /api/create-order to obtain order_id
 * 2. Razorpay checkout modal launch with options and order_id
 * 3. POST /api/verify-payment with razorpay_payment_id, razorpay_order_id, razorpay_signature
 * 4. Error handling: modal dismiss, payment.failed, network errors
 */
function initRazorpayIntegration() {
  const payButtons = document.querySelectorAll('.btn-razorpay-trigger, a[href="#pay-razorpay"]');
  const modal = document.getElementById('razorpay-modal');
  const closeBtn = document.getElementById('close-razorpay-modal');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  payButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>⏳ Preparing Order...</span>';
      btn.setAttribute('disabled', 'true');

      try {
        // Step 1: Obtain Public Key ID (from /api/config or config.js)
        let keyId = '';
        try {
          const configRes = await fetch('/api/config');
          if (configRes.ok) {
            const configData = await configRes.json();
            keyId = configData.razorpay_key_id;
          }
        } catch {
          // Fallback to client config if server config endpoint not reached
        }

        if (!keyId && typeof RECALLC_CONFIG !== 'undefined') {
          keyId = RECALLC_CONFIG.razorpay?.keyId || '';
        }

        // Step 2: Call backend to create Razorpay Order
        const orderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 29900, // 29900 paise = ₹299.00 (min 100 paise)
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
            notes: {
              product: 'RecallLC Pro / Supporter License',
            },
          }),
        });

        if (!orderRes.ok) {
          const errData = await orderRes.json().catch(() => ({}));
          throw new Error(errData.error || `Order creation failed with HTTP ${orderRes.status}`);
        }

        const order = await orderRes.json();
        console.log('[Razorpay] Order created:', order.order_id);

        // Step 3: Load Razorpay Checkout SDK and Open Modal
        loadRazorpayScript(() => {
          btn.innerHTML = originalText;
          btn.removeAttribute('disabled');

          const options = {
            key: keyId || 'rzp_test_TrfV1O5whxyt69',
            amount: order.amount,
            currency: order.currency,
            name: 'RecallLC',
            description: 'RecallLC Pro / Supporter License',
            image: 'assets/icon32.png',
            order_id: order.order_id,
            handler: async function (response) {
              console.log('[Razorpay] Payment successful, verifying signature...', response);
              await verifyPaymentSignature(response);
            },
            modal: {
              ondismiss: function () {
                console.log('[Razorpay] Checkout modal dismissed by user.');
                showPaymentNotification('Payment cancelled. You can try again anytime.', 'warning');
              },
            },
            theme: {
              color: '#7c5cff',
            },
            prefill: {
              name: '',
              email: '',
            },
          };

          // @ts-ignore
          const rzp = new window.Razorpay(options);

          // Handle payment failure event
          rzp.on('payment.failed', function (failureResponse) {
            console.error('[Razorpay] Payment failed:', failureResponse.error);
            showPaymentNotification(
              `Payment failed: ${failureResponse.error.description || 'Transaction declined'} (Code: ${failureResponse.error.code})`,
              'danger',
            );
          });

          rzp.open();
        });
      } catch (err) {
        console.warn('[Razorpay] Standard checkout API unavailable, opening payment options:', err);
        btn.innerHTML = originalText;
        btn.removeAttribute('disabled');

        // Fallback: If backend server is not running or network failed, open manual options modal
        if (modal) {
          modal.style.display = 'flex';
        } else {
          alert(`Could not initiate Razorpay Checkout: ${err.message}`);
        }
      }
    });
  });
}

/**
 * Step 3: Verify Signature on Backend
 */
async function verifyPaymentSignature(paymentResponse) {
  try {
    const verifyRes = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      }),
    });

    const verifyData = await verifyRes.json();

    if (verifyRes.ok && verifyData.success) {
      showPaymentNotification(
        `🎉 Payment Verified! Payment ID: ${paymentResponse.razorpay_payment_id}. Thank you for supporting RecallLC!`,
        'success',
      );
    } else {
      showPaymentNotification(
        `⚠️ Verification Failed: ${verifyData.message || verifyData.error || 'Signature mismatch'}. Please contact support.`,
        'danger',
      );
    }
  } catch (err) {
    console.error('[Razorpay] Verification network error:', err);
    showPaymentNotification(`Error communicating with verification server: ${err.message}`, 'danger');
  }
}

/**
 * In-page Toast / Notification Alert
 */
function showPaymentNotification(message, type = 'success') {
  const existing = document.getElementById('razorpay-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'razorpay-toast';
  const bgColor = type === 'success' ? '#065f46' : type === 'warning' ? '#854d0e' : '#991b1b';
  const borderColor = type === 'success' ? '#34d399' : type === 'warning' ? '#fde047' : '#f87171';

  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    background: ${bgColor};
    border: 1px solid ${borderColor};
    color: #ffffff;
    padding: 14px 20px;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    font-size: 0.9rem;
    font-weight: 500;
    max-width: 400px;
    animation: fadeIn 0.3s ease;
  `;
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

function loadRazorpayScript(callback) {
  if (window.Razorpay) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = callback;
  script.onerror = () => {
    alert('Could not load Razorpay SDK. Please check your internet connection.');
  };
  document.body.appendChild(script);
}

/**
 * Update current year in footer
 */
function updateDynamicYear() {
  const yearEls = document.querySelectorAll('.current-year');
  const currentYear = new Date().getFullYear();
  yearEls.forEach((el) => {
    el.textContent = currentYear;
  });
}
