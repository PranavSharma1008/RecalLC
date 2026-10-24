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

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
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
    const body = await parseJsonBody(req);
    const amount = Number.parseInt(body.amount, 10);
    const currency = (body.currency || 'INR').toUpperCase();
    const receipt = body.receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Validate minimum amount (100 paise = ₹1)
    if (!amount || Number.isNaN(amount) || amount < 100) {
      return sendJson(res, 400, {
        error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).',
      });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return sendJson(res, 500, {
        error: 'Razorpay API credentials not configured on the server.',
      });
    }

    const orderOptions = {
      amount,
      currency,
      receipt,
      notes: body.notes || {
        product: 'RecallLC Pro / Supporter License',
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    return sendJson(res, 200, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (err) {
    console.error('[Razorpay create-order Error]:', err);
    // Razorpay authentication error (401)
    if (err?.statusCode === 401 || err?.error?.code === 'BAD_REQUEST_ERROR') {
      return sendJson(res, err.statusCode || 401, {
        error: err.error?.description || 'Razorpay authentication failed.',
      });
    }
    return sendJson(res, 500, {
      error: err.message || 'Razorpay order creation failed.',
    });
  }
}

/**
 * Handle POST /api/verify-payment
 */
async function handleVerifyPayment(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return sendJson(res, 400, {
        success: false,
        error:
          'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).',
      });
    }

    if (!RAZORPAY_KEY_SECRET) {
      return sendJson(res, 500, {
        success: false,
        error: 'Razorpay secret key not configured on server.',
      });
    }

    // HMAC-SHA256 signature verification
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(text).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(razorpay_signature, 'utf8');

    const isValid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isValid) {
      console.warn(`[Razorpay Signature Mismatch]: Expected ${expectedSignature}, received ${razorpay_signature}`);
      return sendJson(res, 400, {
        success: false,
        message: 'Invalid payment signature. Verification failed.',
      });
    }

    // Signature verified successfully
    return sendJson(res, 200, {
      success: true,
      message: 'Payment verified successfully.',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (err) {
    console.error('[Razorpay verify-payment Error]:', err);
    return sendJson(res, 500, {
      success: false,
      error: err.message || 'Payment verification processing failed.',
    });
  }
}

/**
 * Static file server for landing-page/
 */
function serveStaticFile(req, res) {
  const landingDir = path.join(__dirname, 'landing-page');
  let cleanUrl = req.url.split('?')[0].split('#')[0];
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';
  if (cleanUrl === '/checkout') cleanUrl = '/checkout.html';

  const filePath = path.join(landingDir, cleanUrl);

  // Security: prevent path traversal attacks
  if (!filePath.startsWith(landingDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 fallback
      const notFoundPath = path.join(landingDir, '404.html');
      fs.readFile(notFoundPath, (e, content) => {
        if (!e) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  // API Route: Public Config (Key ID only)
  if (req.url.startsWith('/api/config') && req.method === 'GET') {
    return sendJson(res, 200, {
      razorpay_key_id: RAZORPAY_KEY_ID || '',
      currency: 'INR',
    });
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
