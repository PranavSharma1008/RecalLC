/**
 * RecallLC Backend Server
 *
 * Implements Razorpay Standard Checkout endpoints:
 * 1. POST /api/create-order -> Creates an order with Razorpay Orders API
 * 2. POST /api/verify-payment -> Verifies HMAC-SHA256 signature
 * 3. GET /api/config -> Safely provides public KEY_ID to frontend
 * Also serves the landing page statically at http://localhost:PORT
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Razorpay from 'razorpay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed
          .slice(idx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID ||
  process.env.VITE_RAZORPAY_KEY_ID ||
  (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'rzp_test_testkeyid123' : '');
const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET ||
  (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'mock_dummy_secret_for_testing_only' : '');
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    console.warn(
      '[RecallLC Razorpay] WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing in environment variables (.env).',
    );
  }
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: RAZORPAY_KEY_SECRET || 'dummy_secret_for_tests',
});

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

// In-memory IP rate limiter to protect against DoS & brute-force
const rateLimitStore = new Map();

function isRateLimited(ip, bucket, limit, windowMs) {
  const now = Date.now();
  const key = `${ip}:${bucket}`;
  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    rateLimitStore.set(key, record);
    return false;
  }

  record.count += 1;
  rateLimitStore.set(key, record);
  return record.count > limit;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
).unref();

function getClientIp(req) {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0].trim();
      if (/^(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/.test(first)) {
        return first;
      }
    }
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

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
  // 24 hour retention
  verifiedPaymentsCache.set(paymentId, { verifiedAt: now, expiresAt: now + 24 * 60 * 60 * 1000 });
}

function getAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return '*';
  // Allow Chrome extensions and local development origins
  if (origin.startsWith('chrome-extension://') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return 'null';
}

function getSecurityHeaders(req) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'self' chrome-extension:* http://localhost:* http://127.0.0.1:*",
  };
}

function sendJson(res, statusCode, data, req = null) {
  const payload = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(req
      ? getSecurityHeaders(req)
      : {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        }),
  };
  res.writeHead(statusCode, headers);
  res.end(payload);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Protect against payload DOS (1 MB cap)
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle POST /api/create-order
 */
async function handleCreateOrder(req, res) {
  try {
    const clientIp = getClientIp(req);
    // Rate limit: 30 order creation requests per minute per IP
    if (isRateLimited(clientIp, 'create-order', 30, 60 * 1000)) {
      return sendJson(
        res,
        429,
        {
          error: 'Too many order creation requests. Please try again in a minute.',
        },
        req,
      );
    }

    const body = await parseJsonBody(req);
    const rawAmount = body.amount;
    const numAmount = Number(rawAmount);

    // Validate integer amount (100 paise = ₹1.00; 50,000,000 paise = ₹500,000.00)
    // Strictly disallow floating point amounts, NaN, Infinity, negative numbers, or non-integer inputs
    if (
      rawAmount === undefined ||
      rawAmount === null ||
      typeof rawAmount === 'boolean' ||
      !Number.isInteger(numAmount) ||
      numAmount < 100 ||
      numAmount > 50000000
    ) {
      return sendJson(
        res,
        400,
        {
          error:
            'Invalid amount. Minimum amount is 100 paise (₹1.00) and maximum is 50,000,000 paise (₹500,000.00). Must be a whole integer.',
        },
        req,
      );
    }
    const amount = numAmount;
    const rawCurrency = body.currency || 'INR';
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : 'INR';

    // Currency whitelist validation
    const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
    if (!ALLOWED_CURRENCIES.includes(currency)) {
      return sendJson(
        res,
        400,
        {
          error: `Unsupported currency. Allowed: ${ALLOWED_CURRENCIES.join(', ')}.`,
        },
        req,
      );
    }

    let receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (typeof body.receipt === 'string' && body.receipt.trim()) {
      receipt = body.receipt
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 40);
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return sendJson(
        res,
        500,
        {
          error: 'Razorpay API credentials not configured on the server.',
        },
        req,
      );
    }

    // Sanitize notes object against prototype pollution and oversized fields
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

    const orderOptions = {
      amount,
      currency,
      receipt,
      notes: sanitizedNotes,
    };

    let order;
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      order = {
        id: `order_test_${Date.now()}`,
        amount,
        currency,
        receipt,
      };
    } else {
      order = await razorpay.orders.create(orderOptions);
    }

    return sendJson(
      res,
      200,
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      req,
    );
  } catch (err) {
    console.error('[Razorpay create-order Error]:', err);
    // Razorpay authentication error (401)
    if (err?.statusCode === 401 || err?.error?.code === 'BAD_REQUEST_ERROR') {
      return sendJson(
        res,
        err.statusCode || 401,
        {
          error: err.error?.description || 'Razorpay authentication failed.',
        },
        req,
      );
    }
    return sendJson(
      res,
      500,
      {
        error: err.message || 'Razorpay order creation failed.',
      },
      req,
    );
  }
}

/**
 * Handle POST /api/verify-payment
 */
async function handleVerifyPayment(req, res) {
  try {
    const clientIp = getClientIp(req);
    // Rate limit: 60 verification requests per minute per IP
    if (isRateLimited(clientIp, 'verify-payment', 60, 60 * 1000)) {
      return sendJson(
        res,
        429,
        {
          success: false,
          error: 'Too many verification attempts. Please wait a minute.',
        },
        req,
      );
    }

    const body = await parseJsonBody(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate presence and types
    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' ||
      !razorpay_order_id.trim() ||
      !razorpay_payment_id.trim() ||
      !razorpay_signature.trim()
    ) {
      return sendJson(
        res,
        400,
        {
          success: false,
          error:
            'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
        },
        req,
      );
    }

    // Validate expected structure with strict regex to prevent delimiter manipulation, injection or non-hex payloads
    const orderId = razorpay_order_id.trim();
    const paymentId = razorpay_payment_id.trim();
    const signature = razorpay_signature.trim();

    const ORDER_ID_REGEX = /^order_[a-zA-Z0-9_]{5,60}$/;
    const PAYMENT_ID_REGEX = /^pay_[a-zA-Z0-9_]{5,60}$/;
    const SIGNATURE_REGEX = /^[a-f0-9]{64}$/i;

    if (!ORDER_ID_REGEX.test(orderId) || !PAYMENT_ID_REGEX.test(paymentId) || !SIGNATURE_REGEX.test(signature)) {
      return sendJson(
        res,
        400,
        {
          success: false,
          message: 'Invalid payment signature. Verification failed.',
        },
        req,
      );
    }

    // Defend against replay attacks: reject previously processed payments
    if (isPaymentAlreadyVerified(paymentId)) {
      return sendJson(
        res,
        409,
        {
          success: false,
          error: 'Payment has already been verified and processed.',
          replayed: true,
        },
        req,
      );
    }

    if (!RAZORPAY_KEY_SECRET) {
      return sendJson(
        res,
        500,
        {
          success: false,
          error: 'Razorpay secret key not configured on server.',
        },
        req,
      );
    }

    // HMAC-SHA256 signature verification
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(text).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    const isValid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isValid) {
      console.warn(`[Razorpay Signature Mismatch]: Expected ${expectedSignature}, received ${signature}`);
      return sendJson(
        res,
        400,
        {
          success: false,
          message: 'Invalid payment signature. Verification failed.',
        },
        req,
      );
    }

    // Signature verified successfully
    markPaymentVerified(paymentId);
    return sendJson(
      res,
      200,
      {
        success: true,
        message: 'Payment verified successfully.',
        payment_id: paymentId,
        order_id: orderId,
      },
      req,
    );
  } catch (err) {
    console.error('[Razorpay verify-payment Error]:', err);
    return sendJson(
      res,
      500,
      {
        success: false,
        error: err.message || 'Payment verification processing failed.',
      },
      req,
    );
  }
}

/**
 * Static file server for landing-page/
 */
function serveStaticFile(req, res) {
  try {
    const landingDir = path.resolve(__dirname, 'landing-page');
    let rawUrl = (req.url || '/').split('?')[0].split('#')[0];

    // Decode URI safely to prevent bypasses and unhandled crashes
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(rawUrl);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('400 Bad Request: Malformed URI');
    }

    // Reject null byte injection
    if (decodedUrl.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('400 Bad Request');
    }

    if (decodedUrl === '/' || decodedUrl === '') decodedUrl = '/index.html';
    if (decodedUrl === '/checkout') decodedUrl = '/checkout.html';

    // Canonicalize path and prevent directory traversal
    const safePath = path.resolve(landingDir, '.' + path.normalize(decodedUrl));

    if (safePath !== landingDir && !safePath.startsWith(landingDir + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden');
    }

    // Security: Block any dotfile or hidden file access (.env, .git, .DS_Store, etc.)
    const relativeToLanding = path.relative(landingDir, safePath);
    const hasDotComponent = relativeToLanding.split(path.sep).some((part) => part.startsWith('.'));
    if (hasDotComponent) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('403 Forbidden: Access to hidden files is denied.');
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        const notFoundPath = path.join(landingDir, '404.html');
        fs.readFile(notFoundPath, (e, content) => {
          if (!e) {
            res.writeHead(404, {
              'Content-Type': 'text/html; charset=utf-8',
              ...getSecurityHeaders(req),
            });
            res.end(content);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain', ...getSecurityHeaders(req) });
            res.end('404 Not Found');
          }
        });
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
        ...getSecurityHeaders(req),
      });

      const stream = fs.createReadStream(safePath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('500 Internal Server Error');
      });
      stream.pipe(res);
    });
  } catch (err) {
    console.error('[Static Server Error]:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('500 Internal Server Error');
  }
}

/**
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, getSecurityHeaders(req));
      return res.end();
    }

    // API Routes Handling
    if (req.url.startsWith('/api/')) {
      if (req.url.startsWith('/api/config')) {
        if (req.method === 'GET') {
          return sendJson(
            res,
            200,
            {
              razorpay_key_id: RAZORPAY_KEY_ID || '',
              currency: 'INR',
            },
            req,
          );
        }
        res.writeHead(405, { 'Content-Type': 'application/json', ...getSecurityHeaders(req) });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }

      if (req.url.startsWith('/api/create-order')) {
        if (req.method === 'POST') {
          return handleCreateOrder(req, res);
        }
        res.writeHead(405, { 'Content-Type': 'application/json', ...getSecurityHeaders(req) });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }

      if (req.url.startsWith('/api/verify-payment')) {
        if (req.method === 'POST') {
          return handleVerifyPayment(req, res);
        }
        res.writeHead(405, { 'Content-Type': 'application/json', ...getSecurityHeaders(req) });
        return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }

      res.writeHead(404, { 'Content-Type': 'application/json', ...getSecurityHeaders(req) });
      return res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }

    // Static Assets
    return serveStaticFile(req, res);
  } catch (err) {
    console.error('[Unhandled Request Error]:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('500 Internal Server Error');
  }
});

// Start listening if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  RecallLC Server with Razorpay Standard Checkout`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`  Razorpay Key ID: ${RAZORPAY_KEY_ID}`);
    console.log(`==================================================\n`);
  });
}

export { server, handleCreateOrder, handleVerifyPayment };
