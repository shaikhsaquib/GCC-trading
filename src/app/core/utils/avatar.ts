/**
 * Shared avatar palette — single source of truth for the per-user avatar
 * colours/gradients that were previously duplicated across admin and identity
 * components (and even redefined twice within admin).
 */
export const AVATAR_COLORS = ['#7c4dff', '#00d4ff', '#17c3b2', '#ff4757', '#ffc107', '#00e676'];

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#00d4ff,#17c3b2)',
  'linear-gradient(135deg,#7c4dff,#00d4ff)',
  'linear-gradient(135deg,#17c3b2,#7c4dff)',
  'linear-gradient(135deg,#ffc107,#ff9800)',
  'linear-gradient(135deg,#00d4ff,#7c4dff)',
  'linear-gradient(135deg,#8fa3b8,#4a5568)',
];

/** Deterministic flat colour for a list index. */
export const avatarColor = (idx: number): string => AVATAR_COLORS[idx % AVATAR_COLORS.length];

/** Deterministic gradient for a list index. */
export const avatarGradient = (idx: number): string => AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
