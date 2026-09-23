import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * What a followed club looks like — its abbreviation and its crest — remembered between launches.
 *
 * Favorites store ids and nothing else, on purpose: a name or a crest saved in a preference goes
 * stale when a club rebrands, and the directory is the one place that knows. But the directory is a
 * network round trip, so until it answered, the chips at the top of Home showed a raw id and an
 * empty square for a second or two on every cold start.
 *
 * So the identity is cached rather than stored: written from the directory's own answer, read back
 * at launch, and overwritten by the next answer. It is only ever a head start on the truth — every
 * screen still prefers the live directory when it has it — and it holds only the clubs the reader
 * follows, which is a few dozen bytes each.
 *
 * The crest itself needs no cache of its own: expo-image keeps the file, so once the URL is known
 * again the picture is already on the device.
 */
export type TeamIdentity = { abbr?: string; name?: string; logo?: string; darkLogo?: string };

const KEY = 'teamIdentity';

let cache: Record<string, TeamIdentity> = {};
let hydrated = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

// Started at import, so the read is already in flight by the time Home renders.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, TeamIdentity>;
      // A write that landed first wins: it came from the live directory, this is only the fallback.
      cache = { ...parsed, ...cache };
    }
  })
  .catch(() => { /* no cache is the state we were in before */ })
  .finally(() => { hydrated = true; notify(); });

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
  }, 500);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const snapshot = () => cache;

/**
 * Remember these clubs. Called with whatever the directory just resolved for the ids the reader
 * follows; a club whose details have not changed costs nothing.
 */
export function rememberTeams(entries: Record<string, TeamIdentity>) {
  let changed = false;
  for (const [id, v] of Object.entries(entries)) {
    const key = id.toLowerCase();
    const prev = cache[key];
    if (prev && prev.abbr === v.abbr && prev.logo === v.logo && prev.darkLogo === v.darkLogo && prev.name === v.name) continue;
    cache[key] = v;
    changed = true;
  }
  if (!changed) return;
  notify();
  persist();
}

/** Drop clubs the reader no longer follows, so the cache cannot grow without bound. */
export function forgetTeamsExcept(ids: readonly string[]) {
  const keep = new Set(ids.map((i) => i.toLowerCase()));
  const next: Record<string, TeamIdentity> = {};
  let dropped = false;
  for (const [k, v] of Object.entries(cache)) {
    if (keep.has(k)) next[k] = v;
    else dropped = true;
  }
  if (!dropped) return;
  cache = next;
  notify();
  persist();
}

/** The remembered identity of a club, or undefined until something has told us. */
export function useTeamIdentity() {
  const map = useSyncExternalStore(subscribe, snapshot, snapshot);
  const identity = useCallback((id?: string | null): TeamIdentity | undefined =>
    (id ? map[id.toLowerCase()] : undefined), [map]);
  return { identity, hydrated };
}
