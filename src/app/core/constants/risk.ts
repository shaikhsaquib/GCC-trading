/**
 * KYC risk tiers and their investment limits — single source of truth.
 *
 * The tier limits (LOW 10K / MEDIUM 50K / HIGH 200K AED) drive both the KYC
 * screen copy and the order risk-limit check. Keeping the numeric limit next to
 * the display strings means the two can never drift apart.
 */

export const RISK_TIERS = {
  LOW: {
    limit:       '10,000 AED',
    limitAed:    10_000,
    desc:        'Standard investor — orders up to 10,000 AED',
  },
  MEDIUM: {
    limit:       '50,000 AED',
    limitAed:    50_000,
    desc:        'Verified investor — orders up to 50,000 AED',
  },
  HIGH: {
    limit:       '200,000 AED',
    limitAed:    200_000,
    desc:        'Accredited investor — orders up to 200,000 AED',
  },
} as const;

export type RiskTier = keyof typeof RISK_TIERS;
