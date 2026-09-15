/**
 * User roles — single source of truth.
 *
 * Previously the role→label map was duplicated in header, identity and admin
 * components (with a drift: L2_ADMIN showed as "Admin" in two places and
 * "L2 Admin" in another), and the admin-role set was hand-written in the auth
 * service. Centralising them removes the duplication and the drift.
 */

export const ROLES = {
  INVESTOR:    'INVESTOR',
  KYC_OFFICER: 'KYC_OFFICER',
  L2_ADMIN:    'L2_ADMIN',
  ADMIN:       'ADMIN',
  COMPLIANCE:  'COMPLIANCE',
} as const;

export type Role = keyof typeof ROLES;

/** Human-readable label for each role (shown in the UI). */
export const ROLE_LABELS: Record<string, string> = {
  INVESTOR:    'Investor',
  KYC_OFFICER: 'KYC Officer',
  L2_ADMIN:    'L2 Admin',
  ADMIN:       'Admin',
  COMPLIANCE:  'Compliance',
};

/** Roles that get admin / back-office access. */
export const ADMIN_ROLES: readonly string[] = [
  ROLES.ADMIN, ROLES.L2_ADMIN, ROLES.COMPLIANCE, ROLES.KYC_OFFICER,
];
