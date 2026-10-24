import crypto from 'node:crypto';
import http from 'node:http';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error server.js is untyped JS
import { handleCreateOrder, handleVerifyPayment, server } from '../../../server.js';
import { MESSAGE_CHANNEL } from '../../services/messaging';
import { getMessageListeners } from '../setup';

function createMockReqRes(body: unknown, method = 'POST', url = '/api/verify-payment') {
  const req = new http.IncomingMessage({} as any);
  req.method = method;
  req.url = url;

  let statusCode = 200;
  let headers: Record<string, string> = {};
  let responseData = '';
  let resolveResult: (val: { status: number; headers: Record<string, string>; data: any }) => void;
  const resultPromise = new Promise<{ status: number; headers: Record<string, string>; data: any }>((resolve) => {
    resolveResult = resolve;
  });

  const res = {
    writeHead: (code: number, hdrs: Record<string, string>) => {
      statusCode = code;
      headers = hdrs;
    },
    end: (chunk?: string) => {
      if (chunk) responseData += chunk;
      try {
        resolveResult({ status: statusCode, headers, data: JSON.parse(responseData) });
      } catch {
        resolveResult({ status: statusCode, headers, data: responseData });
      }
    },
  } as unknown as http.ServerResponse;

  setTimeout(() => {
    req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
    req.emit('end');
  }, 5);

  return { req, res, getResult: () => resultPromise };
}

describe('Penetration Testing & Security Exploit Defenses', () => {
  const SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_dummy_secret_for_testing_only';

  describe('1. Razorpay Payment Gateway Penetration Tests', () => {
    it('blocks payment replay attacks (same payment_id verified twice)', async () => {
      const orderId = 'order_test_replay_001';
      const paymentId = `pay_test_replay_${Date.now()}`;
      const signature = crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      const payload = {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      };

      // 1st Verification: Must Succeed
      const firstAttempt = createMockReqRes(payload);
      void handleVerifyPayment(firstAttempt.req, firstAttempt.res);
      const res1 = await firstAttempt.getResult();
      expect(res1.status).toBe(200);
      expect(res1.data.success).toBe(true);

      // 2nd Verification (Replay Attack): Must be blocked with 409 Conflict
      const secondAttempt = createMockReqRes(payload);
      void handleVerifyPayment(secondAttempt.req, secondAttempt.res);
      const res2 = await secondAttempt.getResult();
      expect(res2.status).toBe(409);
      expect(res2.data.success).toBe(false);
      expect(res2.data.replayed).toBe(true);
      expect(res2.data.error).toContain('already been verified');
    });

    it('rejects delimiter injection and malicious pipe characters in order/payment IDs', async () => {
      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: 'order_test_123|pay_injected_attacker',
        razorpay_payment_id: 'pay_test_456',
        razorpay_signature: 'a'.repeat(64),
      });

      void handleVerifyPayment(req, res);
      const result = await getResult();
      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
      expect(result.data.message).toContain('Invalid payment signature');
    });

    it('rejects non-hex and malformed signature values before crypto comparison', async () => {
      const { req, res, getResult } = createMockReqRes({
        razorpay_order_id: 'order_test_valid_id',
        razorpay_payment_id: 'pay_test_valid_id',
        razorpay_signature: 'not_a_hex_signature_with_invalid_characters_zzzzzzzzzzzzzzzzzzzz',
      });

      void handleVerifyPayment(req, res);
      const result = await getResult();
      expect(result.status).toBe(400);
      expect(result.data.success).toBe(false);
    });

    it('rejects floating-point, boolean, and non-integer amounts in create-order', async () => {
      // Float amount test
      const floatAttempt = createMockReqRes({ amount: 299.99 });
      void handleCreateOrder(floatAttempt.req, floatAttempt.res);
      const resFloat = await floatAttempt.getResult();
      expect(resFloat.status).toBe(400);
      expect(resFloat.data.error).toContain('Must be a whole integer');

      // Boolean amount test
      const boolAttempt = createMockReqRes({ amount: true });
      void handleCreateOrder(boolAttempt.req, boolAttempt.res);
      const resBool = await boolAttempt.getResult();
      expect(resBool.status).toBe(400);

      // Trailing string test
      const strAttempt = createMockReqRes({ amount: '500xyz' });
      void handleCreateOrder(strAttempt.req, strAttempt.res);
      const resStr = await strAttempt.getResult();
      expect(resStr.status).toBe(400);
    });

    it('neutralizes prototype pollution payloads in create-order notes', async () => {
      const pollutedNotes = JSON.parse(
        '{"__proto__": {"pollutedKey": "evil"}, "constructor": {"prototype": {"evilKey": true}}, "donor": "Alice"}',
      );

      const { req, res, getResult } = createMockReqRes({
        amount: 50000,
        notes: pollutedNotes,
      });

      void handleCreateOrder(req, res);
      const result = await getResult();
      expect(result.status).toBe(200);

      // Verify global Object prototype was not polluted
      // @ts-expect-error verifying prototype pollution defense
      expect(Object.prototype.pollutedKey).toBeUndefined();
      // @ts-expect-error verifying prototype pollution defense
      expect(Object.prototype.evilKey).toBeUndefined();
    });
  });

  describe('2. Server Endpoint & Static File Defenses', () => {
    it('returns 405 Method Not Allowed JSON when calling POST routes via GET', async () => {
      const req = new http.IncomingMessage({} as any);
      req.method = 'GET';
      req.url = '/api/create-order';

      let statusCode = 200;
      let body = '';
      const res = {
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (data: string) => {
          body = data;
        },
      } as unknown as http.ServerResponse;

      server.emit('request', req, res);

      expect(statusCode).toBe(405);
      expect(JSON.parse(body).error).toBe('Method Not Allowed');
    });

    it('returns 404 JSON for unknown /api/* routes instead of serving static HTML', async () => {
      const req = new http.IncomingMessage({} as any);
      req.method = 'GET';
      req.url = '/api/nonexistent-endpoint';

      let statusCode = 200;
      let body = '';
      const res = {
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (data: string) => {
          body = data;
        },
      } as unknown as http.ServerResponse;

      server.emit('request', req, res);

      expect(statusCode).toBe(404);
      expect(JSON.parse(body).error).toBe('API endpoint not found');
    });

    it('blocks dotfile access (.env, .git) with 403 Forbidden in static server', async () => {
      const req = new http.IncomingMessage({} as any);
      req.method = 'GET';
      req.url = '/.env';

      let statusCode = 200;
      let body = '';
      const res = {
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (data: string) => {
          body = data;
        },
      } as unknown as http.ServerResponse;

      server.emit('request', req, res);

      expect(statusCode).toBe(403);
      expect(body).toContain('403 Forbidden');
    });
  });

  describe('3. Chrome Extension IPC Boundary Defenses', () => {
    let dispatch: (msg: unknown, sender: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;

    beforeAll(async () => {
      await import('../../background/serviceWorker');
      const listeners = getMessageListeners();
      const listener = listeners[listeners.length - 1]!;

      dispatch = (msg: unknown, sender: unknown) =>
        new Promise((resolve) => {
          listener(msg, sender, (res) => resolve(res as never));
        });
    });

    it('rejects all queries from a rogue external extension ID', async () => {
      const rogueSender = {
        id: 'external-malicious-extension-id',
        url: 'chrome-extension://external-malicious-extension-id/exploit.html',
      };

      // Attempt to read problem catalog
      const resList = await dispatch(
        {
          channel: MESSAGE_CHANNEL,
          method: 'list-problems',
        },
        rogueSender,
      );
      expect(resList.ok).toBe(false);
      expect(resList.error).toContain('external extension access is forbidden');

      // Attempt to read user stats
      const resStats = await dispatch(
        {
          channel: MESSAGE_CHANNEL,
          method: 'stats',
        },
        rogueSender,
      );
      expect(resStats.ok).toBe(false);
      expect(resStats.error).toContain('external extension access is forbidden');
    });

    it('blocks content scripts from accessing unprivileged database dump methods (list-problems)', async () => {
      const contentSender = {
        id: 'recalllc-test',
        url: 'https://leetcode.com/problems/two-sum/',
      };

      const res = await dispatch(
        {
          channel: MESSAGE_CHANNEL,
          method: 'list-problems',
        },
        contentSender,
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain('restricted to extension pages');
    });
  });
});
