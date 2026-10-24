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

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn(
    '[RecallLC Razorpay] WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing in environment variables (.env).',
  );
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID || '',
  key_secret: RAZORPAY_KEY_SECRET || '',
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
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
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
    const amount = Number.parseInt(body.amount, 10);
    const rawCurrency = body.currency || 'INR';
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : 'INR';

    // Validate minimum and maximum amount (100 paise = ₹1.00; 50,000,000 paise = ₹500,000.00)
    if (!amount || Number.isNaN(amount) || amount < 100 || amount > 50000000) {
      return sendJson(
        res,
        400,
        {
          error: 'Invalid amount. Minimum amount is 100 paise (₹1.00) and maximum is 50,000,000 paise.',
        },
        req,
      );
    }

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

    // Sanitize notes object
    const sanitizedNotes = { product: 'RecallLC Pro / Supporter License' };
    if (typeof body.notes === 'object' && body.notes !== null && !Array.isArray(body.notes)) {
      for (const [k, v] of Object.entries(body.notes).slice(0, 10)) {
        if (typeof k === 'string' && typeof v === 'string') {
          sanitizedNotes[k.slice(0, 40)] = v.slice(0, 200);
        }
      }
    }

    const orderOptions = {
      amount,
      currency,
      receipt,
      notes: sanitizedNotes,
    };

    const order = await razorpay.orders.create(orderOptions);

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

    // Validate expected structure
    const orderId = razorpay_order_id.trim();
    const paymentId = razorpay_payment_id.trim();
    const signature = razorpay_signature.trim();

    if (!orderId.startsWith('order_') || !paymentId.startsWith('pay_')) {
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

    // API Route: Public Config (Key ID only)
    if (req.url.startsWith('/api/config') && req.method === 'GET') {
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

    // API Route: Create Order
    if (req.url.startsWith('/api/create-order') && req.method === 'POST') {
      return handleCreateOrder(req, res);
    }

    // API Route: Verify Signature
    if (req.url.startsWith('/api/verify-payment') && req.method === 'POST') {
      return handleVerifyPayment(req, res);
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
