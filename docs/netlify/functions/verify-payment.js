import crypto from 'node:crypto';

// Replay protection: store verified payments for 24 hours
const verifiedPaymentsCache = new Map();

function isPaymentAlreadyVerified(paymentId) {
  const now = Date.now();
  const entry = verifiedPaymentsCache.get(paymentId);
  if (!entry) return false;
  if (now > entry.expiresAt) {
    verifiedPaymentsCache.delete(paymentId);
    return false;
  }
  return true;
}

function markPaymentVerified(paymentId) {
  const now = Date.now();
  verifiedPaymentsCache.set(paymentId, { verifiedAt: now, expiresAt: now + 24 * 60 * 60 * 1000 });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Razorpay secret key not configured on server.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' ||
      !razorpay_order_id.trim() ||
      !razorpay_payment_id.trim() ||
      !razorpay_signature.trim()
    ) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error:
            'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
        }),
      };
    }

    const orderId = razorpay_order_id.trim();
    const paymentId = razorpay_payment_id.trim();
    const signature = razorpay_signature.trim();

    const ORDER_ID_REGEX = /^order_[a-zA-Z0-9_]{5,60}$/;
    const PAYMENT_ID_REGEX = /^pay_[a-zA-Z0-9_]{5,60}$/;
    const SIGNATURE_REGEX = /^[a-f0-9]{64}$/i;

    if (!ORDER_ID_REGEX.test(orderId) || !PAYMENT_ID_REGEX.test(paymentId) || !SIGNATURE_REGEX.test(signature)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Invalid payment signature. Verification failed.',
        }),
      };
    }

    if (isPaymentAlreadyVerified(paymentId)) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Payment has already been verified and processed.',
          replayed: true,
        }),
      };
    }

    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(text).digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    const isValid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid payment signature. Verification failed.',
        }),
      };
    }

    markPaymentVerified(paymentId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Payment verified successfully.',
        payment_id: paymentId,
        order_id: orderId,
      }),
    };
  } catch (err) {
    console.error('[Netlify verify-payment Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message || 'Payment verification processing failed.' }),
    };
  }
}
