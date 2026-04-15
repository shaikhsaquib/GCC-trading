import { z } from 'zod';

const currencySchema = z.enum(['AED', 'SAR', 'KWD', 'QAR', 'OMR', 'BHD', 'USD']);

export const depositSchema = z.object({
  amount:   z.number().positive('Amount must be positive').max(1_000_000),
  currency: currencySchema.default('AED'),
});

export const withdrawSchema = z.object({
  amount:   z.number().positive().max(1_000_000),
  currency: currencySchema.default('AED'),
  bankName: z.string().min(2).max(100),
  iban:     z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/, 'Invalid IBAN format'),
  totpCode: z.string().length(6).regex(/^\d+$/).optional(),
});
