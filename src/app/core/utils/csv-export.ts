/**
 * Client-side CSV download. Pass column headers (label → row key) and rows;
 * generates a UTF-8 BOM CSV so Excel opens it correctly.
 */
export function exportToCsv(
  filename: string,
  columns: { label: string; key: string }[],
  rows: Record<string, unknown>[],
): void {
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = columns.map(c => escape(c.label)).join(',');
  const body   = rows.map(r => columns.map(c => escape(r[c.key])).join(',')).join('\n');
  const csv    = `﻿${header}\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
