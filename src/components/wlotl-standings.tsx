import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { TeamLogo } from '@/components/team-logo';
import { placeName } from '@/lib/format';
import { fetchStandings, leagueColors, type LeagueId } from '@/lib/leagues';
import { usePullRefresh } from '@/lib/pull-refresh';
import { useTheme } from '@/lib/theme';
import type { StandingsTeam } from '@/lib/types';

type ViewType = 'division' | 'conference' | 'league';
type Section = { confHeader: string | null; label: string; teams: StandingsTeam[] };

const strip = (s?: string) => (s || '').replace(/\s+(Division|Conference)$/i, '');
const sortTeams = (list: StandingsTeam[]) => [...list].sort((a, b) => b.pts - a.pts || b.w - a.w);

// Group AHL/CHL standings by division (default), conference, or a flat league table — deriving the
// conference→division structure from the data (handles QMJHL where conference == division).
function buildSections(teams: StandingsTeam[], view: ViewType): Section[] {
  if (view === 'league') return [{ confHeader: null, label: '', teams: sortTeams(teams) }];

  const confs = [...new Set(teams.map((t) => t.conference).filter(Boolean))] as string[];

  if (view === 'conference') {
    if (!confs.length) return [{ confHeader: null, label: '', teams: sortTeams(teams) }];
    return confs.map((c) => ({ confHeader: null, label: c, teams: sortTeams(teams.filter((t) => t.conference === c)) }));
  }

  // division view
  if (!confs.length) {
    const divs = [...new Set(teams.map((t) => t.division).filter(Boolean))] as string[];
    if (!divs.length) return [{ confHeader: null, label: '', teams: sortTeams(teams) }];
    return divs.map((d) => ({ confHeader: null, label: strip(d).toUpperCase(), teams: sortTeams(teams.filter((t) => t.division === d)) }));
  }

  const out: Section[] = [];
  for (const conf of confs) {
    const inConf = teams.filter((t) => t.conference === conf);
    const divs = [...new Set(inConf.map((t) => t.division).filter(Boolean))] as string[];
    // Degenerate structure (no divisions, or a single division named like the conference) → one section.
    if (!divs.length || (divs.length === 1 && strip(divs[0]) === strip(conf))) {
      out.push({ confHeader: null, label: conf, teams: sortTeams(inConf) });
    } else {
      divs.forEach((d, di) => out.push({
        confHeader: di === 0 ? conf : null,
        label: strip(d).toUpperCase(),
        teams: sortTeams(inConf.filter((t) => t.division === d)),
      }));
    }
  }
  return out;
}

export function WlotlStandings({ league, card }: { league: string; card: string }) {
  const t = useTheme();
  const isQmjhl = league === 'qmjhl'; // QMJHL groups by conference only — no divisions
  const viewOptions: ViewType[] = isQmjhl ? ['conference', 'league'] : ['division', 'conference', 'league'];
  const pill = leagueColors(league as LeagueId, t.mode === 'dark').pill;
  const [view, setView] = useState<ViewType>(isQmjhl ? 'conference' : 'division');
  const q = useQuery({ queryKey: ['standings', league], queryFn: () => fetchStandings(league as LeagueId) });
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const sections = useMemo(() => buildSections(q.data ?? [], view), [q.data, view]);

  if (q.isLoading) return <StateView kind="loading" />;
  if (q.isError) return <StateView kind="error" message="Couldn’t load standings." onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <StateView kind="empty" title="No standings" message="Not available for this league yet." />;

  const superTint = t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  return (
    <View style={{ flex: 1 }}>
      <ViewFilter value={view} onChange={setView} options={viewOptions} pill={pill} />
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}>
        {sections.map((sec, si) => (
          <View key={si}>
            {sec.confHeader ? (
              <View style={{ backgroundColor: superTint, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: t.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{sec.confHeader}</Text>
              </View>
            ) : null}
            <View style={[styles.row, { backgroundColor: superTint, borderColor: t.border }]}>
              <Text style={{ flex: 1, color: t.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }} numberOfLines={1}>{sec.label || 'Team'}</Text>
              <Text style={[styles.stat, { color: t.sub }]}>GP</Text>
              <Text style={[styles.rec, { color: t.sub }]}>W-L-OTL</Text>
              <Text style={[styles.stat, { color: t.sub, fontWeight: '700' }]}>PTS</Text>
            </View>
            {sec.teams.map((team, i) => <Row key={team.routeId ?? team.abbr ?? i} team={team} card={card} />)}
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function Row({ team, card }: { team: StandingsTeam; card: string }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/teams/[teamId]', params: { teamId: team.routeId ?? team.abbr.toLowerCase() } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.row, { borderColor: t.border, backgroundColor: card }])}>
        <TeamLogo uri={team.logo} size={22} />
        <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{placeName(team.name)}</Text>
        <Text style={[styles.stat, { color: t.sub }]}>{team.gp}</Text>
        <Text style={[styles.rec, { color: t.text, fontVariant: ['tabular-nums'] }]}>{team.w}-{team.l}-{team.otl}</Text>
        <Text style={[styles.stat, { color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{team.pts}</Text>
      </Pressable>
    </Link>
  );
}

function ViewFilter({ value, onChange, options, pill }: { value: ViewType; onChange: (v: ViewType) => void; options: ViewType[]; pill: string }) {
  const t = useTheme();
  const onText = t.mode === 'dark' ? '#0b0b0b' : '#ffffff';
  return (
    <View style={styles.filter}>
      <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.border }]}>
        {options.map((v) => {
          const on = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)} style={[styles.segItem, on && { backgroundColor: pill }]}>
              <Text style={{ color: on ? onText : t.sub, fontSize: 13, fontWeight: on ? '700' : '600', textTransform: 'capitalize' }}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filter: { paddingHorizontal: 12, paddingBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 22, fontSize: 13, textAlign: 'center' },
  stat: { width: 34, textAlign: 'right', fontSize: 13 },
  rec: { width: 78, textAlign: 'right', fontSize: 13 },
});
