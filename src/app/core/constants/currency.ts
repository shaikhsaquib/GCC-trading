/**
 * Currency — single source of truth.
 *
 * AED is the platform's base/account currency (matches the DB default and the
 * wallet). Replaces the scattered hardcoded 'AED'/'SAR' literals across the UI.
 */

export const DEFAULT_CURRENCY = 'AED';

/** Currencies a user may hold an account in (mirrors the DB CHECK constraint). */
export const SUPPORTED_CURRENCIES = ['AED', 'SAR', 'KWD', 'QAR', 'OMR', 'BHD', 'USD'] as const;

export type Currency = typeof SUPPORTED_CURRENCIES[number];
