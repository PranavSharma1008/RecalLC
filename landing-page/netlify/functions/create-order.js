import Razorpay from 'razorpay';

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

  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Razorpay API credentials not configured on the server.' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const rawAmount = body.amount;
    const numAmount = Number(rawAmount);

    if (
      rawAmount === undefined ||
      rawAmount === null ||
      typeof rawAmount === 'boolean' ||
      !Number.isInteger(numAmount) ||
      numAmount < 100 ||
      numAmount > 50000000
    ) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error:
            'Invalid amount. Minimum amount is 100 paise (₹1.00) and maximum is 50,000,000 paise (₹500,000.00). Must be a whole integer.',
        }),
      };
    }

    const amount = numAmount;
    const rawCurrency = body.currency || 'INR';
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : 'INR';

    const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
    if (!ALLOWED_CURRENCIES.includes(currency)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Unsupported currency. Allowed: ${ALLOWED_CURRENCIES.join(', ')}.` }),
      };
    }

    let receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (typeof body.receipt === 'string' && body.receipt.trim()) {
      receipt = body.receipt
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 40);
    }

    const sanitizedNotes = { product: 'RecallLC Pro / Supporter License' };
    if (typeof body.notes === 'object' && body.notes !== null && !Array.isArray(body.notes)) {
      for (const [k, v] of Object.entries(body.notes).slice(0, 10)) {
        if (
          typeof k === 'string' &&
          typeof v === 'string' &&
          k !== '__proto__' &&
          k !== 'constructor' &&
          k !== 'prototype'
        ) {
          sanitizedNotes[k.slice(0, 40).replace(/[^a-zA-Z0-9_\- ]/g, '')] = v.slice(0, 200);
        }
      }
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: sanitizedNotes,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      }),
    };
  } catch (err) {
    console.error('[Netlify create-order Error]:', err);
    return {
      statusCode: err.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Razorpay order creation failed.' }),
    };
  }
}
