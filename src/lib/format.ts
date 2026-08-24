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

// --- Game-day helpers --------------------------------------------------------
// Scores are organised by *slate* (a day that has games), so these all work in the DEVICE's timezone:
// a 10:30 PM ET puck drop is still "tonight" for an ET viewer but already tomorrow in UTC. Never derive
// a day key by slicing an ISO string — that gives the UTC day and shifts games onto the wrong date.

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO timestamp → local YYYY-MM-DD.
export function localDayKey(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : dayKey(d);
}

// Days between two YYYY-MM-DD keys (b - a), calendar-days apart, ignoring time.
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  if (!ay || !by) return 0;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// "Today" / "Tomorrow" / "Yesterday" / "Sat, Sep 29" for a YYYY-MM-DD key.
export function dayLabel(key: string, today: string = dayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Compact date for a game card: "Sep 29". Empty when the game is on `today` (the time alone is enough).
// `fallbackDay` is an already-local YYYY-MM-DD for feeds that publish a date but no puck-drop time —
// seeded NCAA schedules, which would otherwise be the only undated cards in the app.
export function cardDate(iso?: string, fallbackDay?: string, today: string = dayKey()): string {
  const key = localDayKey(iso) || (fallbackDay ?? '').slice(0, 10);
  if (!key || key === today) return '';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Which hockey season a date belongs to, as the starting year: seasons run roughly Aug → Jun, so
// Apr 2026 is still the 2025 season while Sep 2026 begins the 2026 one. Used to spot the boundary
// between two seasons in a list of games without needing the feeds to label it.
export function seasonOf(date?: string): number | null {
  if (!date) return null;
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return null;
  return m >= 8 ? y : y - 1;
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
