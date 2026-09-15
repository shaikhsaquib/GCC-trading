/**
 * Shared constants barrel — import everything from '../../core/constants'.
 *
 * A deliberately small "shared kernel": cross-cutting values (roles, risk
 * tiers, currency, fees) that many components need, but NOT domain models —
 * those stay with their feature to avoid coupling.
 */
export * from './roles';
export * from './risk';
export * from './currency';
export * from './fees';
