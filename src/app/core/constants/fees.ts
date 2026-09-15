/**
 * Fee rates shown in the order ticket — single source of truth.
 *
 * NOTE: this is the client-side order-preview fee model (a flat commission plus
 * VAT on the commission). It is deliberately separate from the backend
 * settlement fee schedule (buyer/seller/settlement basis points), which is
 * authoritative for actual charges. Kept here so the trading screen's estimate
 * isn't a set of bare magic numbers.
 */

export const FEES = {
  /** Commission as a fraction of trade value (0.10%). */
  COMMISSION_RATE: 0.001,
  /** VAT as a fraction of the commission (15%). */
  VAT_RATE: 0.15,
} as const;
