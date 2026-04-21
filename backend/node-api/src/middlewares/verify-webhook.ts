import crypto from 'crypto';
import axios   from 'axios';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Onfido sends HMAC-SHA256 of the raw request body in the X-SHA2-Signature header.
 * If ONFIDO_WEBHOOK_SECRET is not configured the check is skipped (dev/demo mode).
 */
export function verifyOnfidoSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = config.onfido.webhookSecret;
  if (!secret) { next(); return; }

  const signature = req.headers['x-sha2-signature'] as string | undefined;
  if (!signature) {
    res.status(401).json({ error: 'Missing X-SHA2-Signature header' });
    return;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Raw body unavailable' });
    return;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Pad to equal length before timingSafeEqual to avoid length-leaking errors
  const sigBuf = Buffer.from(signature.padEnd(expected.length, '\0'));
  const expBuf = Buffer.from(expected.padEnd(signature.length, '\0'));

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}

/**
 * HyperPay/OppWa does not use a shared-secret signature scheme.
 * Instead we re-query their payment status API with the provided checkout ID
 * to confirm the payment is genuinely completed before crediting the wallet.
 * If HYPERPAY_API_KEY is not configured the check is skipped (dev/demo mode).
 */
export async function verifyHyperpayPayment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!config.hyperpay.apiKey) { next(); return; }

  const { id: hyperpayId } = req.body as { id?: string };
  if (!hyperpayId) {
    res.status(400).json({ error: 'Missing payment id in webhook body' });
    return;
  }

  try {
    const url = `https://eu-test.oppwa.com/v1/checkouts/${hyperpayId}/payment` +
                `?entityId=${encodeURIComponent(config.hyperpay.entityId)}`;

    const { data } = await axios.get<{ result: { code: string } }>(url, {
      headers: { Authorization: `Bearer ${config.hyperpay.apiKey}` },
      timeout: 8_000,
    });

    // OppWa success codes: 000.000.000 (approved) or 000.100.110 (approved via 3DS)
    const code = data?.result?.code ?? '';
    if (!/^000\.(000|100)\.\d{3}$/.test(code)) {
      res.status(400).json({ error: `Payment not completed (code: ${code})` });
      return;
    }
  } catch {
    res.status(502).json({ error: 'Could not verify payment status with HyperPay' });
    return;
  }

  next();
}
