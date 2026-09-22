// Derived favorites — the clubs the user's followed players play for — and the prospect switch's
// actions. Mirrors lib/use-follows.ts and lib/prospect-follow-actions.ts on the web, on React Query
// instead of a hand-rolled localStorage cache: two queries, four hours fresh, a stale answer served
// while a new one is fetched, never a blank. Nothing derived is persisted beyond that: the club is
// re-resolved, so a trade or a call-up moves the games on its own.
import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { api } from './api';
import { useFavorites, type FavoriteTeam } from './favorites';
import { mergeClubs, rowIsPlayer, type DerivedClub, type DerivedPlayer, type FollowedPlayerClub, type ProspectClubs } from './follows';

const FRESH_MS = 4 * 3600_000;
const NONE: DerivedClub[] = [];

const fetchFollowedPlayers = (ids: string) =>
  api<{ players?: FollowedPlayerClub[] }>(`/follows/players?ids=${encodeURIComponent(ids)}`).then((r) => r.players ?? []);
const fetchProspectClubs = (team: string) => api<ProspectClubs>(`/team/${team}/prospect-clubs`);

/** The affiliates an org's resolver names, shaped as favorites (untagged; the store tags them). */
const affiliatesOf = (d: ProspectClubs): Omit<FavoriteTeam, 'via'>[] =>
  (d.affiliates ?? []).map((a) => ({ id: a.teamId, league: a.league }));

export function useDerivedClubs(): { clubs: DerivedClub[]; ready: boolean } {
  const { loaded, favoritePlayers, prospectFollows, syncProspectAffiliates } = useFavorites();
  const starIds = useMemo(() => [...favoritePlayers].sort().join(','), [favoritePlayers]);
  const orgs = useMemo(() => prospectFollows.map((f) => f.team).sort(), [prospectFollows]);

  const stars = useQuery({
    queryKey: ['follows-players', starIds],
    queryFn: () => fetchFollowedPlayers(starIds),
    enabled: loaded && !!starIds,
    staleTime: FRESH_MS,
    gcTime: 24 * 3600_000,
  });
  const orgQs = useQueries({
    queries: orgs.map((team) => ({
      queryKey: ['prospect-clubs', team],
      queryFn: () => fetchProspectClubs(team),
      enabled: loaded,
      staleTime: FRESH_MS,
      gcTime: 24 * 3600_000,
    })),
  });

  // Each org's affiliates kept in step with what the resolver says — a new affiliate is added and
  // tagged, one the org dropped is removed, a crest the first resolution lacked is filled in.
  const orgData = orgQs.map((q) => q.data);
  // One key for "any org's answer changed", so the effects below run on new data and not on every render.
  const orgKey = orgData.map((d) => d?.fetchedAt ?? '').join('|');
  useEffect(() => {
    orgData.forEach((d) => { if (d?.affiliates) syncProspectAffiliates(d.team, affiliatesOf(d)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgKey]);

  const clubs = useMemo(() => {
    if (!loaded) return NONE;
    const s = starIds ? stars.data : [];
    if (!s) return NONE;
    return mergeClubs(s, orgData.filter((d): d is ProspectClubs => !!d?.clubs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, starIds, stars.data, orgKey]);

  const ready = loaded && (!starIds || stars.data !== undefined);
  return { clubs, ready };
}

/** A row in any list that might name a followed player: a box score, a leaderboard, a roster. */
export type NamedRow = { name: string; playerId?: number | string; playerSlug?: string };

/**
 * Is this row one of the user's followed players — a hand-starred one, or a prospect of an org whose
 * switch is on? Used wherever a name appears in a LIST: box scores, leaderboards, team rosters.
 *
 * Deliberately NOT used on a player's own page (the star there already says it) or on a team's
 * prospects tab, where every row would be marked and the mark would say nothing.
 *
 * The stored slug is the certain match where a row carries one; otherwise rowIsPlayer joins on the
 * feed's own id, and failing that on the surname plus an equivalent first name.
 */
export function useFollowedMatcher(): (row: NamedRow) => DerivedPlayer | undefined {
  const { clubs } = useDerivedClubs();
  const players = useMemo(() => clubs.flatMap((c) => c.players), [clubs]);
  return useCallback(
    (row: NamedRow) => {
      if (!players.length || !row?.name) return undefined;
      if (row.playerSlug) {
        const bySlug = players.find((p) => p.starIds.includes(row.playerSlug!));
        if (bySlug) return bySlug;
      }
      return players.find((p) => rowIsPlayer(row, p));
    },
    [players],
  );
}

/**
 * The prospect switch's two actions. ON is instant: the follow is written at once so the control
 * flips, and the affiliates arrive in the background from the same resolver that resolves the
 * prospects — added through the same sync the Home hook runs, so whichever finishes first wins.
 */
export function useProspectFollowActions() {
  const { isFollowingProspects, followProspects, unfollowProspects, syncProspectAffiliates } = useFavorites();
  const enable = useCallback((team: string) => {
    const t = team.toLowerCase();
    followProspects(t, []);
    fetchProspectClubs(t).then((d) => { if (d?.affiliates) syncProspectAffiliates(t, affiliatesOf(d)); }).catch(() => {});
  }, [followProspects, syncProspectAffiliates]);
  const disable = useCallback((team: string) => unfollowProspects(team.toLowerCase()), [unfollowProspects]);
  return { isOn: (team: string) => isFollowingProspects(team.toLowerCase()), enable, disable };
}
