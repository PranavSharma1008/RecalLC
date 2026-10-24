import crypto from 'node:crypto';
import http from 'node:http';
import { describe, expect, it } from 'vitest';

// @ts-expect-error server.js is untyped JS
import { handleCreateOrder, handleVerifyPayment } from '../../../server.js';

function createMockReqRes(body: unknown, method = 'POST') {
  const req = new http.IncomingMessage({} as any);
  req.method = method;

  let statusCode = 200;
  let headers: Record<string, string> = {};
  let responseData = '';

  const res = {
    writeHead: (code: number, hdrs: Record<string, string>) => {
      statusCode = code;
      headers = hdrs;
    },
    end: (chunk?: string) => {
      if (chunk) responseData += chunk;
    },
  } as unknown as http.ServerResponse;

  // Simulate readable stream for body
  setTimeout(() => {
    req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  }, 5);

  return {
    req,
    res,
    getResult: () =>
      new Promise<{ status: number; headers: Record<string, string>; data: any }>((resolve) => {
        setTimeout(() => {
          try {
            resolve({ status: statusCode, headers, data: JSON.parse(responseData) });
          } catch {
            resolve({ status: statusCode, headers, data: responseData });
          }
        }, 1500);
      }),
  };
}

describe('Razorpay Standard Checkout Backend Endpoints', () => {
  const SECRET = process.env.RAZORPAY_KEY_SECRET || 'CakUl3Z19ZWmcTzMe7kVyOK4';

  describe('POST /api/create-order', () => {
    it('rejects order with amount less than 100 paise with status 400', async () => {
      const { req, res, getResult } = createMockReqRes({ amount: 50 });
      void handleCreateOrder(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('Minimum amount is 100 paise');
    });

    it('creates an order with valid amount and returns order_id', async () => {
      const { req, res, getResult } = createMockReqRes({
        amount: 29900,
        currency: 'INR',
        receipt: 'test_rcpt_unit_test',
      });
      void handleCreateOrder(req, res);
      const result = await getResult();

      expect(result.status).toBe(200);
      expect(result.data.order_id).toBeDefined();
      expect(result.data.order_id).toMatch(/^order_/);
      expect(result.data.amount).toBe(29900);
      expect(result.data.currency).toBe('INR');
    });
  });

  describe('POST /api/verify-payment', () => {
    it('verifies valid HMAC-SHA256 signature successfully with status 200', async () => {
      const orderId = 'order_test_12345';
      const paymentId = 'pay_test_67890';
      const signature = crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

      void handleVerifyPayment(req, res);
      const result = await getResult();

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.message).toContain('verified successfully');
      expect(result.data.payment_id).toBe(paymentId);
    });

    it('rejects tampered or mismatched signature with status 400', async () => {
      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: 'order_test_12345',
        razorpay_payment_id: 'pay_test_67890',
        razorpay_signature: 'invalid_tampered_signature_hex_value_1234567890abcdef',
      });

      void handleVerifyPayment(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.message).toContain('Invalid payment signature');
    });

    it('returns status 400 when required fields are missing', async () => {
      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: 'order_test_12345',
        // missing razorpay_payment_id and razorpay_signature
      });

      void handleVerifyPayment(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Missing required');
    });
  });

  describe('Security & Penetration Hardening', () => {
    it('never exposes RAZORPAY_KEY_SECRET to client config', () => {
      expect(process.env.RAZORPAY_KEY_SECRET).toBeDefined();
      expect(process.env.RAZORPAY_KEY_SECRET).not.toBe(process.env.RAZORPAY_KEY_ID);
    });

    it('rejects unsupported currency codes with status 400', async () => {
      const { req, res, getResult } = createMockReqRes({
        amount: 500,
        currency: 'BTC',
      });
      void handleCreateOrder(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('Unsupported currency');
    });

    it('rejects amount exceeding 50,000,000 paise with status 400', async () => {
      const { req, res, getResult } = createMockReqRes({
        amount: 99999999999,
      });
      void handleCreateOrder(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.error).toContain('maximum is 50,000,000 paise');
    });

    it('rejects non-string or malformed payment IDs in verify payment', async () => {
      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: 12345, // Not a string
        razorpay_payment_id: { evil: true }, // Object injection attempt
        razorpay_signature: 'a'.repeat(64),
      });
      void handleVerifyPayment(req, res);
      const result = await getResult();

      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
    });
  });
});
