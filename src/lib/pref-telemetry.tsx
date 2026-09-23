import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE } from './api';
import { useFavorites } from './favorites';
import { useFollowedLeagues } from './followed-leagues';
import { fetchAllTeams } from './leagues';
import { queryClient } from './query';
import { useDerivedClubs } from './use-follows';

/**
 * How many people follow each team, player and league — the same anonymous count the web sends
 * (components/preference-telemetry.tsx), so the report at /api/admin/preference-stats covers the app
 * as well as the site.
 *
 * What is sent: an id that identifies this install and nothing else, and the preference lists
 * themselves. No account, no device details, no history. The server keeps counts and a week of
 * adds and removes; it diffs whole snapshots, so every send carries the current state rather than a
 * change, and a snapshot with nothing in it is discarded at both ends.
 *
 * WHEN it is sent is gated the same way the web gates Google Analytics: a reader in a region that
 * requires consent sends nothing. The app has no consent banner to ask with, and until it does,
 * "not placed yet" and "in a regulated region" both mean no — the safe direction, and the same
 * answer that visitor would get on the web before choosing.
 */
const SHARE_KEY = 'omni:sharePrefs';
const ANON_KEY = 'omni:anonId';
const SENT_AT_KEY = 'omni:prefsSentAt';
const REGULATED_KEY = 'omni:regulated';
const DEBOUNCE_MS = 1500;
const DAY_MS = 86_400_000;

/** A v4 UUID. Not a secret and not a key — an opaque counter id, so Math.random is the right cost. */
function uuidV4(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

async function anonId(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(ANON_KEY);
    if (stored) return stored;
    const minted = uuidV4();
    await AsyncStorage.setItem(ANON_KEY, minted);
    return minted;
  } catch {
    return null;   // no storage means no stable id, and an unstable one would inflate every count
  }
}

/**
 * The reader's own switch, which comes before the regional one.
 *
 * Counting what people follow is defensible and disclosed, but it happened whether or not anyone
 * wanted it to, and outside a regulated region there was no way to decline. Off means off
 * everywhere; it does not reach back and remove what was already counted, which the privacy policy
 * says to ask us for.
 */
export async function isSharingPrefs(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SHARE_KEY)) !== 'off';
  } catch {
    return true;   // same answer as a device that never touched the switch
  }
}

export async function setSharingPrefs(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SHARE_KEY, on ? 'on' : 'off');
  } catch { /* a device that cannot remember the choice keeps the default */ }
}

type Regulated = { value: boolean; at: number };

/**
 * Is this reader somewhere that requires consent first? Asked of the same route the web asks, and
 * remembered for a day. Anything other than a definite "no" means no send.
 */
async function analyticsAllowed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(REGULATED_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as Regulated;
      if (typeof cached?.value === 'boolean' && Date.now() - cached.at < DAY_MS) return cached.value === false;
    }
  } catch { /* fall through and ask */ }
  try {
    const r = await fetch(`${API_BASE}/geo`);
    const d = (await r.json()) as { regulated?: boolean | null };
    if (typeof d?.regulated !== 'boolean') return false;   // headers absent → treat as regulated
    await AsyncStorage.setItem(REGULATED_KEY, JSON.stringify({ value: d.regulated, at: Date.now() } satisfies Regulated));
    return d.regulated === false;
  } catch {
    return false;
  }
}

/** "connor-mcdavid-8478402" → "Connor Mcdavid", for a star whose club we have not resolved yet. */
function nameFromSlug(slug: string): string {
  return slug
    .replace(/-\d+$/, '')
    .replace(/-[0-9a-f]{8}-[0-9a-f-]+$/i, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function PreferenceTelemetry() {
  const { favoriteTeams, favorites, prospectFollows, loaded } = useFavorites();
  const { followed, customized, loaded: leaguesLoaded } = useFollowedLeagues();
  // Already fetched for the follows features and cached for hours, so the names cost nothing extra.
  const { clubs } = useDerivedClubs();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSig = useRef<string | null>(null);

  // The server requires a name on each team and player; the app stores ids only, on purpose, and
  // resolves names live. So they are joined here, from the directory the star list already carries
  // and the followed-players answer, and fall back to the id when neither has one yet.
  const named = clubs.flatMap((c) => c.players);
  const prefs = {
    teams: favoriteTeams.map((t) => ({ id: t.id, league: t.league, ...(t.via ? { via: t.via } : {}) })),
    players: favorites.map((id) => ({
      id,
      name: named.find((p) => p.starIds.includes(id))?.name || nameFromSlug(id),
    })),
    leagues: [...followed],
    leaguesCustomized: customized,
    prospects: prospectFollows.map((f) => f.team),
  };
  const empty = !prefs.teams.length && !prefs.players.length && !prefs.prospects.length && !prefs.leaguesCustomized;
  const sig = JSON.stringify(prefs);

  useEffect(() => {
    if (!loaded || !leaguesLoaded || empty) return;
    // Nothing changed and it is not a new day — the daily heartbeat is what keeps a reader who never
    // touches a preference counted at all.
    const run = async () => {
      let due = lastSig.current !== null && lastSig.current !== sig;
      if (!due) {
        const at = Number((await AsyncStorage.getItem(SENT_AT_KEY)) ?? 0);
        due = Date.now() - at > DAY_MS;
      }
      lastSig.current = sig;
      if (!due) return;
      // The reader's switch is asked first: it is a choice, where the regional check is a rule.
      if (!(await isSharingPrefs())) return;
      if (!(await analyticsAllowed())) return;
      const id = await anonId();
      if (!id) return;
      // The directory is asked for only once a send is actually due, and through the shared cache,
      // so a reader who never opens Teams or Search does not fetch it on the app's account.
      const directory = await queryClient
        .fetchQuery({ queryKey: ['all-teams'], queryFn: fetchAllTeams, staleTime: 60 * 60_000 })
        .catch(() => []);
      const snapshot = {
        ...prefs,
        teams: prefs.teams.map((t) => ({
          ...t,
          name: directory.find((d) => d.id.toLowerCase() === t.id.toLowerCase())?.name || t.id.toUpperCase(),
        })),
      };
      await AsyncStorage.setItem(SENT_AT_KEY, String(Date.now())).catch(() => {});
      fetch(`${API_BASE}/telemetry/prefs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anonId: id, snapshot }),
      }).catch(() => { /* telemetry never surfaces an error */ });
    };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded, leaguesLoaded, empty]);

  // A phone rarely relaunches, so the day rolls over while the app sits in the background.
  useEffect(() => {
    const onState = (s: AppStateStatus) => { if (s === 'active') lastSig.current = null; };
    const sub = AppState.addEventListener('change', onState);
    return () => sub.remove();
  }, []);

  return null;
}
