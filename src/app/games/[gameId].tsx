import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GameBoxScore, ScratchesCard } from '@/components/game-box-score';
import { SegmentedFilter } from '@/components/segmented-filter';
import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { canonicalTeamId } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { followedLabel, followedOnGame, type FollowedOnGame } from '@/lib/follows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GamePreview } from '@/components/game-preview';
import { GameRosters } from '@/components/game-rosters';
import { useFollowedMatcher } from '@/lib/use-follows';
import { fetchGameDetail } from '@/lib/game';
import type { GameDetail, GDTeam, GoalInfo, PenaltyInfo } from '@/lib/game-detail-types';
import { composeTeamName } from '@/lib/team-name';
import { formatGameTime, type TimeZoneMode } from '@/lib/game-time';
import { useTheme } from '@/lib/theme';
import { useTimeZoneMode } from '@/lib/time-zone-mode';
import { useDerivedClubs } from '@/lib/use-follows';

/**
 * The date a game is played, for a feed that does not send one.
 *
 * The NCAA's does not: its games have no start time at all, so an upcoming one could only say
 * "Upcoming", which the reader already knew from opening it. Our own id for those games carries the
 * date — ncaa-20261002-alas-anchorage-denver — so it is read back from there rather than left out.
 */
function dateFromGameId(id?: string): string | undefined {
  const m = /-(\d{4})(\d{2})(\d{2})(?:-|$)/.exec(id ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** The iOS navigation bar's own height, under the status bar, and the clearance its buttons need. */
const NAV_ROW = 44;
const SIDE_CLEAR = 62;

/**
 * What the band says: the clock while a game is on, FINAL once it is over, and before it starts the
 * date and the face-off time. A generic "Upcoming" is dropped when there is a date to show instead —
 * it says nothing the date does not — and kept when there is not.
 */
function bandLabel(g: GameDetail, gameId: string, mode: TimeZoneMode): string {
  if (g.status !== 'UPCOMING') return g.statusLabel ?? '';
  const when = shortDate(g.startTimeUTC) || shortDate(dateFromGameId(gameId));
  // The start on the reader's chosen clock (lib/game-time), as every card shows it; the feed's own
  // label only when there is no start time to format.
  const label = g.startTimeUTC
    ? formatGameTime(g.startTimeUTC, { mode, venueTimeZone: g.venueTimeZone })
    : /^upcoming$/i.test((g.statusLabel ?? '').trim()) ? '' : g.statusLabel ?? '';
  return [when, when && label === when ? '' : label].filter(Boolean).join(' · ') || g.statusLabel || '';
}

export default function GameScreen() {
  const { mode: timeMode } = useTimeZoneMode();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { gameId, away, home, fresh } = useLocalSearchParams<{ gameId: string; away?: string; home?: string; fresh?: string }>();
  // Opened from a notification: `fresh` is when it was tapped (lib/push useNotificationTaps).
  const freshAt = Number(fresh) || 0;

  const [tab, setTab] = useState('Summary');
  // The first load after a tap goes around the edge cache, whose copy of a live game can be from
  // before the goal the alert announced; the watcher has already refreshed the server's copy.
  const bypassed = useRef(false);
  const q = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => {
      const bypass = freshAt > 0 && !bypassed.current;
      bypassed.current = true;
      return fetchGameDetail(gameId, bypass ? String(freshAt) : undefined);
    },
    refetchOnMount: 'always',
    refetchInterval: (query) => (query.state.data?.status === 'LIVE' ? 15_000 : false),
  });

  // A copy loaded before the tap — this game was on Home, say — is not shown while the fresh one is
  // on its way: a moment of loading beats a score the reader has just been told is wrong.
  const staleForTap = freshAt > 0 && q.dataUpdatedAt < freshAt;
  const g = staleForTap ? undefined : q.data;
  // The user's followed players on this game, for the strip and the starred lineup rows.
  const { clubs } = useDerivedClubs();
  const followed = followedOnGame(g, clubs);
  const r = g?.rosters;
  const hasBox = !!r && [r.away, r.home].some((x) => x.forwards.length || x.defense.length || x.goalies.length);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* The bar is transparent and untitled: "NYI @ NYR" only repeated the two rows below it, so
          the band carries what a reader actually opens a game for — the period and the clock, or
          the date it starts, or that it is over. */}
      <Stack.Screen options={{ title: '', headerTransparent: true, headerShadowVisible: false }} />

      <View style={[styles.statusBand, { height: NAV_ROW + insets.top, paddingTop: insets.top }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ color: g?.status === 'LIVE' ? t.live : t.text, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
          {g ? bandLabel(g, gameId, timeMode) : ''}
        </Text>
      </View>
      {/* The two clubs sit in the same block as the state above them, the way the team page's crest
          and name sit with theirs — one top section, not a band and then a floating card. */}
      {g ? <Scoreboard g={g} awayId={away} homeId={home} /> : null}
      {q.isLoading || (staleForTap && !q.isError) ? (
        <StateView kind="loading" />
      ) : q.isError || !g ? (
        <StateView kind="empty" title="Game details unavailable" message="We couldn’t load this game." onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
          {followed.length ? <FollowedStrip followed={followed} /> : null}
          {g.periodScores?.length ? <LineScore g={g} /> : null}
          {g.status === 'UPCOMING' ? (
            <>
              {g.preview || g.previewTitle || g.previewSummary ? <Upcoming g={g} /> : null}
              <GamePreview g={g} gameId={gameId} away={g.awayTeam} home={g.homeTeam} />
              {/* Pregame NHL scratches arrive before the box score does — on their own until then. */}
              {!hasBox && g.scratches && (g.scratches.away.length || g.scratches.home.length) ? <ScratchesCard g={g} followed={followed} /> : null}
              {/* The rosters stand in for a lineup only while there is no written preview and no box
                  score — once either exists there is something better to read. */}
              {!hasBox && !g.preview ? <GameRosters g={g} /> : null}
            </>
          ) : hasBox ? (
            <>
              <SegmentedFilter options={['Summary', 'Box Score']} value={tab} onChange={setTab} pill={t.accent} flush />
              {tab === 'Box Score' ? <GameBoxScore g={g} followed={followed} /> : <PlayedBody g={g} />}
            </>
          ) : (
            <PlayedBody g={g} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * A club's crest and name on the scoreboard, tappable through to its team page when we know which
 * page that is.
 *
 * Linked or not, it is ONE node carrying the row's style. It used to wrap the linked case in an
 * extra Link and Pressable, which laid the row out differently from the unlinked one: the crest
 * survived and everything else collapsed to nothing. That only showed when a game was opened from a
 * card, because a card passes the team ids and nothing else does — so the broken path was the one
 * every reader took and the working one was the only one easy to test.
 */
function TeamName({ team, routeId, centered }: { team: GDTeam; routeId?: string; centered?: boolean }) {
  const t = useTheme();
  // The full name, composed the one way a full name is built — a repeat (HV71 HV71) collapses.
  const label = composeTeamName(team.name, team.nickname) || team.abbr;
  const body = (
    <>
      <TeamLogo uri={team.logo} darkUri={team.darkLogo} size={36} />
      {/* Centred, the name sizes to itself so the pair sits in the middle; against a score column it
          takes the room instead, so the numbers stay where the eye expects them. */}
      <View style={centered ? { flexShrink: 1 } : { flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
      </View>
    </>
  );
  const rowStyle = centered ? styles.teamRowCentered : styles.teamRow;
  if (!routeId) return <View style={rowStyle}>{body}</View>;
  // Canonicalise: these ids come from the scoreboard, where CHL teams are keyed by league code
  // ("qmjhl-2") rather than the client code the /teams route and its endpoint expect.
  return (
    <Pressable
      style={rowStyle}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/teams/[teamId]', params: { teamId: canonicalTeamId(routeId) } })}>
      {body}
    </Pressable>
  );
}

function Scoreboard({ g, awayId, homeId }: { g: GameDetail; awayId?: string; homeId?: string }) {
  const t = useTheme();
  const played = g.status !== 'UPCOMING';
  const where = [g.seriesInfo, g.venue, g.venueLocation].filter(Boolean).join(' · ');
  const row = (team: GDTeam, id?: string) => (
    <View style={[styles.sbRow, !played && { justifyContent: 'center' as const }]}>
      <TeamName team={team} routeId={id} centered={!played} />
      {played ? <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' }}>{team.score ?? 0}</Text> : null}
    </View>
  );
  return (
    <View style={[styles.matchup, { borderBottomColor: t.border }]}>
      {row(g.awayTeam, awayId)}
      {/* Away above, home below, as the matchup is said and written. Before a game there are no
          scores to tell them apart, so the "@" does it — quiet enough not to be read as a score,
          and tucked into the gap so the block barely grows. */}
      {!played ? <Text style={[styles.at, { color: t.subtle }]}>@</Text> : null}
      {row(g.homeTeam, homeId)}
      {/* Where it is played and where to watch it are two different questions, and running them
          together wrapped mid-answer — "Scotiabank Arena · Toronto, ON · 📺" and then the channel
          alone on the next line. A line each. */}
      {where ? <Text style={{ color: t.subtle, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{where}</Text> : null}
      {g.network ? <Text style={{ color: t.subtle, fontSize: 12, textAlign: 'center', marginTop: 2 }}>📺 {g.network}</Text> : null}
    </View>
  );
}

/** One line above the tabs: who the user follows on this game and whether they dressed. */
function FollowedStrip({ followed }: { followed: FollowedOnGame[] }) {
  const t = useTheme();
  const word = { dressed: 'in lineup', scratched: 'not dressed', unknown: '' } as const;
  return (
    <View style={[styles.card, { borderColor: `${t.accent}66`, backgroundColor: `${t.accent}14`, paddingVertical: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 }]}>
      <Text style={{ color: t.accent, fontSize: 12, fontWeight: '800' }}>Your players</Text>
      {followed.map((p) => (
        <Text key={`${p.side}-${p.id}`} style={{ color: p.status === 'scratched' ? t.subtle : t.text, fontSize: 12 }}>
          <Text style={{ fontWeight: '600' }}>{followedLabel(p)}</Text>
          {word[p.status] ? <Text style={{ color: t.sub }}> · {word[p.status]}</Text> : null}
        </Text>
      ))}
    </View>
  );
}

function LineScore({ g }: { g: GameDetail }) {
  const t = useTheme();
  const cols = g.periodScores ?? [];
  const cell = (v: number | null) => (v == null ? '–' : String(v));
  // Shots on goal, as a column beside the goal total — where a box score puts it.
  //
  // Only when the league actually reports it. NCAA sends nothing at all, and the HockeyTech feeds
  // send zeros for games where shots weren't tracked; both have to hide the column rather than show
  // a blank or a 0-0, either of which reads as "nobody took a shot" instead of "not reported".
  // One team above zero is proof shots are being tracked, so the other side's genuine 0 — a team
  // five minutes into the first period — still prints as 0 rather than a dash.
  const hasSog = [g.awayTeam, g.homeTeam].some((x) => typeof x.sog === 'number' && x.sog > 0);
  const sogOf = (team: GDTeam) => (typeof team.sog === 'number' ? team.sog : '–');
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, paddingVertical: 8 }]}>
      <View style={styles.lsRow}>
        <Text style={[styles.lsTeam, { color: t.sub }]} />
        {cols.map((c, i) => <Text key={i} style={[styles.lsCell, { color: t.sub, fontWeight: '700' }]}>{c.label}</Text>)}
        <Text style={[styles.lsCell, { color: t.sub, fontWeight: '700' }]}>T</Text>
        {hasSog ? <Text style={[styles.lsCell, { color: t.sub, fontWeight: '700' }]}>SOG</Text> : null}
      </View>
      {(['away', 'home'] as const).map((side) => {
        const team = side === 'away' ? g.awayTeam : g.homeTeam;
        const total = cols.reduce((s, c) => s + (c[side] ?? 0), 0);
        return (
          <View key={side} style={styles.lsRow}>
            <Text style={[styles.lsTeam, { color: t.text, fontWeight: '600' }]}>{team.abbr}</Text>
            {cols.map((c, i) => <Text key={i} style={[styles.lsCell, { color: t.text }]}>{cell(c[side])}</Text>)}
            <Text style={[styles.lsCell, { color: t.text, fontWeight: '800' }]}>{total}</Text>
            {hasSog ? <Text style={[styles.lsCell, { color: t.sub }]}>{sogOf(team)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function Upcoming({ g }: { g: GameDetail }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.section, { color: t.sub }]}>PREVIEW</Text>
      {g.previewTitle ? (
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', lineHeight: 22, marginBottom: 4 }}>{g.previewTitle}</Text>
      ) : null}
      {g.previewSummary ? (
        <Text style={{ color: t.sub, fontSize: 14, lineHeight: 20, marginBottom: 8 }}>{g.previewSummary}</Text>
      ) : null}
      {/* The body arrives as blank-line-separated paragraphs; running them together loses the shape. */}
      {g.preview ? (
        g.preview.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
          <Text key={i} style={{ color: t.text, fontSize: 14, lineHeight: 21, marginTop: i ? 10 : 0 }}>{para.trim()}</Text>
        ))
      ) : null}
    </View>
  );
}

function PlayedBody({ g }: { g: GameDetail }) {
  const t = useTheme();
  // The reader's own players, marked wherever the summary names them — the accent colour, the same
  // mark the box score uses, and no glyph to push the name along.
  const followed = useFollowedMatcher();
  const hasScoring = g.scoring?.some((p) => p.goals.length);
  const logoFor = (abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.logo : g.homeTeam.logo);
  const darkLogoFor = (abbr: string) => (abbr === g.awayTeam.abbr ? g.awayTeam.darkLogo : g.homeTeam.darkLogo);
  return (
    <>
      {g.threeStars?.length ? (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.section, { color: t.sub }]}>THREE STARS</Text>
          {g.threeStars.map((s) => (
            <View key={s.star} style={styles.starRow}>
              <Text numberOfLines={1} style={{ color: t.accent, fontSize: 14, fontWeight: '800', minWidth: 46 }}>{'★'.repeat(s.star)}</Text>
              <Text style={{ flex: 1, color: followed({ name: s.name }) ? t.accent : t.text, fontSize: 14, fontWeight: followed({ name: s.name }) ? '800' : '600' }} numberOfLines={1}>{s.name} <Text style={{ color: t.sub }}>{s.teamAbbr}</Text></Text>
              <Text style={{ color: t.sub, fontSize: 13 }}>{s.goals}G {s.assists}A</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.section, { color: t.sub }]}>SCORING</Text>
        {hasScoring ? g.scoring.map((p, pi) => (
          <View key={pi} style={{ marginBottom: 6 }}>
            <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 }}>{p.label}</Text>
            {p.goals.length ? p.goals.map((goal, gi) => <GoalRow key={gi} goal={goal} logo={logoFor(goal.teamAbbr)} darkLogo={darkLogoFor(goal.teamAbbr)} />) : <Text style={{ color: t.subtle, fontSize: 12 }}>No goals</Text>}
          </View>
        )) : <Text style={{ color: t.subtle, fontSize: 13 }}>No scoring yet.</Text>}
      </View>

      {g.penalties?.some((p) => p.penalties.length) ? (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.section, { color: t.sub }]}>PENALTIES</Text>
          {/* Grouped by period, like SCORING above. Flattening these read as one list running from
              0:00 to 20:00 three times over, with no way to tell which period a penalty was in. */}
          {g.penalties.map((p, pi) => (
            p.penalties.length ? (
              <View key={pi} style={{ marginBottom: 6 }}>
                <Text style={{ color: t.subtle, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 2 }}>{p.label}</Text>
                {p.penalties.map((pen, i) => (
                  <PenaltyRow key={i} pen={pen} logo={logoFor(pen.teamAbbr)} darkLogo={darkLogoFor(pen.teamAbbr)} />
                ))}
              </View>
            ) : null
          ))}
        </View>
      ) : null}
    </>
  );
}

function GoalRow({ goal, logo, darkLogo }: { goal: GoalInfo; logo?: string; darkLogo?: string }) {
  const t = useTheme();
  const followed = useFollowedMatcher();
  const scorerMine = !!followed({ name: goal.scorer });
  const assists = goal.assists ?? [];
  return (
    <View style={styles.goalRow}>
      <Text style={{ color: t.sub, fontSize: 16, fontWeight: '600', width: 46, fontVariant: ['tabular-nums'] }}>{goal.time}</Text>
      <TeamLogo uri={logo} darkUri={darkLogo} size={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: scorerMine ? t.accent : t.text, fontSize: 14, fontWeight: scorerMine ? '800' : '600' }} numberOfLines={1}>
          {goal.scorer}{goal.goalType ? <Text style={{ color: t.accent }}> {goal.goalType}</Text> : null}
        </Text>
        {assists.length ? (
          <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={1}>
            {assists.map((a, i) => {
              const mine = !!followed({ name: a.name });
              return (
                <Text key={i} style={mine ? { color: t.accent, fontWeight: '700' } : undefined}>
                  {i ? ', ' : ''}{a.name}
                </Text>
              );
            })}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{goal.awayScore}-{goal.homeScore}</Text>
    </View>
  );
}

// Two lines, matching GoalRow: player on top, infraction beneath. On one line the infraction was
// truncated for anything longer than a word or two — "Unsportsmanlike Cnd." and "Game Misc-Check to
// Head" both ran off the end.
function PenaltyRow({ pen, logo, darkLogo }: { pen: PenaltyInfo; logo?: string; darkLogo?: string }) {
  const t = useTheme();
  return (
    <View style={styles.penRow}>
      <Text style={{ color: t.sub, fontSize: 16, fontWeight: '600', width: 46, fontVariant: ['tabular-nums'] }}>{pen.time}</Text>
      <TeamLogo uri={logo} darkUri={darkLogo} size={24} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{pen.player}</Text>
        <Text style={{ color: t.sub, fontSize: 12 }} numberOfLines={2}>{pen.description}</Text>
      </View>
      {/* "2m", not "2'" — and not "2:00", which sits beside the period time in the same row and
          would read as another clock rather than a length. */}
      <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {pen.isPenaltyShot ? 'PS' : `${pen.duration}m`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The navigation band, wearing the game's state. Padded clear of the back button on both sides so
  // the text sits in the middle of the screen rather than the middle of what is left of it.
  statusBand: { justifyContent: 'center', paddingHorizontal: SIDE_CLEAR },
  // No card chrome: it is the bottom half of the header, not the first thing on the page.
  matchup: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  // Bigger than it reads: the line box is given room for the glyph and then pulled back up by the
  // margin, so the symbol grows without the block growing with it.
  at: { textAlign: 'center', fontSize: 15, lineHeight: 18, fontWeight: '700', marginTop: 0, marginBottom: -10 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 4 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  sbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  teamRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamRowCentered: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  lsTeam: { width: 44, fontSize: 13 },
  lsCell: { flex: 1, textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  penRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
});
