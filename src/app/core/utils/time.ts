/**
 * timeAgo — human-friendly relative time.
 *
 * Single source of truth for the "X ago" formatting that was previously
 * copy-pasted (with diverging output) across admin, identity, notifications,
 * scheduler, dashboard, kyc, and aml-compliance components.
 *
 * Returns '—' for null/undefined/invalid input so callers don't each guard.
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';

  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}
