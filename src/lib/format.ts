// Small display formatters shared across team-hub tabs.

export function shortDate(d?: string): string {
  if (!d) return '';
  const date = new Date(d.length <= 10 ? `${d}T12:00:00` : d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeOfDay(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// seconds → "M:SS" (time on ice)
export function mmss(sec?: number): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Place/city name from a full "Place Nickname" team name (drops the last word). Best-effort — two-word
// nicknames (e.g. "Wheat Kings") leave an extra word; fine for AHL/CHL standings display.
export function placeName(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName;
}

export function pct3(v?: number): string {
  if (v == null) return '—';
  return (v > 1 ? v / 100 : v).toFixed(3).replace(/^0/, '');
}
