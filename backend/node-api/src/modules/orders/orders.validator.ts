import { z } from 'zod';

// Limit-orders-require-price is enforced in OrdersService.placeOrder so the
// schema stays a plain ZodObject (the validate middleware requires one).
export const placeOrderSchema = z.object({
  bondId:    z.string().uuid('bondId must be a valid UUID'),
  side:      z.enum(['Buy', 'Sell']),
  orderType: z.enum(['Market', 'Limit']),
  quantity:  z.number().positive('Quantity must be positive').max(1_000_000),
  price:     z.number().positive('Price must be positive').max(1_000_000).optional(),
  tif:       z.enum(['Day', 'GTC', 'FOK', 'IOC']).optional(),
});
