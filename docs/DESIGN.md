# Omni Hockey — iOS/iPad App Design Spec

> **Status:** Draft v1 for review. This is the source of truth for the mobile app's information
> architecture, navigation, screens, and design system. We build against this — not ad hoc.
> Last updated 2026-07-28.

---

## 1. Vision & Principles

**What it is:** A native iOS/iPad app that mirrors the omnihockey.com feature set across **NHL, AHL,
CHL (OHL/WHL/QMJHL), and NCAA D1** (USHL hidden/partial). It is a **client of the production API**
(`https://omnihockey.com/api/*`) — the web repo stays the single backend/source of truth.

**Decisions locked in (2026-07-28):**
- **Core job:** All-in-one — mirror the website's breadth.
- **v1 leagues:** NHL + AHL + CHL + NCAA.
- **v1 scope:** **Read-only.** No auth, no push/widgets/Live Activities in v1 (designed-for, fast follow).
- **Look:** **Native iOS-first** — Apple HIG, SF Pro, SF Symbols, large titles, system materials; the
  omni blue (`#208AEF`) as accent, team colors as contextual accents.

**Principles:**
1. **Native feel over web parity.** When the web does something un-iOS (stacked nav rows, hover), we
   translate it to the platform idiom, not reproduce it. This also smooths App Store review.
2. **Content priority is adaptive.** Core data (scores, standings, stats, rosters) always shows.
   **Secondary content is sacrificable** (news, extended leaders, deep splits) — hidden when space is
   tight, **surfaced to fill whitespace** (few games on a slate, tall phones below the fold, iPad panes).
3. **One data layer, cached.** All fetching goes through a typed client with caching + live polling; no
   ad hoc `fetch` in screens.
4. **Graceful everywhere.** Offseason, empty slates, partial data, and offline all render calm empty
   states — never a blank screen or crash.
5. **Design once.** Shared components (cards, rows, pickers, states) so leagues/screens stay consistent.

---

## 2. Platforms & Targets

- **iPhone** (primary) — iOS 17+ (covers ~95% of active devices; enables modern SwiftUI/SF Symbols).
- **iPad** — universal app, `supportsTablet`. Adaptive layouts via size classes (see §8).
- **Orientation:** iPhone portrait-first (rotation allowed); iPad all orientations.
- **Dark mode:** first-class, follows system.
- **Dynamic Type + accessibility:** support text scaling, VoiceOver labels on interactive rows.

---

## 3. Information Architecture

We adopt the **three-axis model** from the web repo's `docs/design/mobile-nav.md`, adapted natively:

### Axis 1 — Destination tab bar (bottom, fixed 5)

| Tab | SF Symbol (proposed) | Purpose |
|-----|----------------------|---------|
| **Scores** (default) | `sportscourt` / `hockey.puck.fill` | Date-scoped games for the selected league. Home base. |
| **Standings** | `list.number` | League/conference standings + (in season) playoff bracket. |
| **Stats** | `chart.bar.fill` | Skater/goalie leaders for the selected league. |
| **Teams** | `shield.lefthalf.filled` | Browse teams by league; **search** (teams + players) lives here; entry to Team Hubs. |
| **More** | `ellipsis.circle` | Favorites mgmt, Schedules calendar, seasonal hubs (Draft/Playoffs), Settings, legal/about. |

### Axis 2 — League picker (persistent, above content on Scores/Standings/Stats/Teams)

A horizontal, scrollable segmented strip: **NHL · AHL · OHL · WHL · QMJHL · NCAA**. For NCAA, tapping
reveals a **conference sub-picker** (AHA, B1G, CCHA, ECAC, HE, NCHC, Independents) as a menu/sheet.
Selection is **global** — changing the league on Scores keeps it on Standings/Stats/Teams (shared state).

> This resolves two of the open issues directly: **CHL is split into OHL/WHL/QMJHL** (they're distinct
> leagues), and **NCAA gets a conference picker** for its conference-based standings.

### Axis 3 — Events / season shelf (contextual, deferred UI)

Model active events (Playoffs, Draft, Free Agency, Memorial Cup, NCAA Tournament, WJC) as promotion-
weighted items. The top-promoted event can surface a banner on Scores and a hub under More. **v1: model
the data, ship a single "Playoffs/Bracket" affordance in Standings; full hubs are a fast follow.**

### Global controls
- **Search:** native large-title search bar on the **Teams** tab → searches teams (local directory via
  `/api/all-teams`) + players (`/api/search/players`). No separate search tab.
- **Favorites (★):** cross-cutting. A **My Teams** strip pins to the top of Scores; star/unstar from any
  team hub; managed in More → Favorites. Stored in `AsyncStorage` (local-only v1).

---

## 4. Navigation Patterns (native iOS)

- **Tab bar:** `expo-router` Tabs with **SF Symbols** (via `expo-symbols`), not PNGs. Translucent
  material background.
- **Stacks per tab:** each tab owns a native stack (`react-native-screens` native-stack) with **large
  titles** that collapse on scroll. Push for detail (team → player → game).
- **Team Hub sub-navigation:** a **segmented control** (Home · Schedule · Roster · Stats · Prospects*)
  under the team hero, not nested tab bars. *(Prospects = NHL only; USHL = Roster · Stats only.)*
- **Game Detail sub-navigation:** sticky collapsing hero + segmented control (Scoring · Penalties ·
  Rosters · Preview/Glance).
- **Sheets:** league/conference drill-down, filters, favorites picker use native sheets
  (`.sheet`, detents) rather than full pushes.
- **Date navigation (Scores):** a compact date bar (‹ Today ›) + tap-to-open calendar sheet.
- **Pull-to-refresh** everywhere lists load remote data. **Swipe-back** gesture standard.

---

## 5. League & Conference Model

| League | Picker entry | Scores API | Standings API | Stats API | Team id format | Team API base |
|--------|--------------|-----------|---------------|-----------|----------------|---------------|
| NHL | NHL | `/scores` | `/nhl-standings` | `/nhl-stats` | `det` (bare abbr) | `/team/{id}` |
| AHL | AHL | `/ahl-scores` | `/ahl-standings` | `/ahl-stats` | `ahl-{htId}` | `/ahl-team/{htId}` |
| CHL-OHL | OHL | `/chl-scores`† | `/ht-standings/ohl` | `/chl-stats/ohl` | `chl-ohl-{htId}` | `/chl-team/ohl-{htId}` |
| CHL-WHL | WHL | `/chl-scores`† | `/ht-standings/whl` | `/chl-stats/whl` | `chl-whl-{htId}` | `/chl-team/whl-{htId}` |
| CHL-QMJHL | QMJHL | `/chl-scores`† | `/ht-standings/qmjhl` | `/chl-stats/qmjhl` | `chl-lhjmq-{htId}` | `/chl-team/lhjmq-{htId}` |
| NCAA | NCAA + conf | `/ncaa-scores` | `/ncaa-standings` (by conf) | `/ncaa-stats` | `ncaa-{seoSlug}` | `/ncaa-team/{seoSlug}` |
| USHL (hidden) | — | — | — | `/ushl-team/{id}/stats` | `ushl-{id}` | `/ushl-team/{id}` |

† `/chl-scores` returns all three leagues combined; the mobile app **filters client-side by the
selected sub-league** (each game carries its league) so OHL/WHL/QMJHL each show only their games.

**Standings shape divergence:** NHL/AHL/CHL are division-based `W-L-OTL / PTS`. **NCAA is
conference-based `W-L-T`** with overall + conference records and **no unified points column** — it needs
its own row layout (Overall + Conf columns), rendered under the conference picker. Handle via a
`kind: 'wlotl' | 'ncaa'` discriminator in the standings normalizer.

**QMJHL nuance:** URL/client code is `lhjmq` (French), displayed as "QMJHL".

---

## 6. Screen Inventory

Legend: **P**=phone, **T**=iPad adaptation noted in §8. ✅ v1, 🕒 fast-follow.

### 6.1 Scores (tab, ✅)
- League picker + **My Teams** strip (favorites' next/live game) + date bar.
- List of `GameCard`s for the selected league+date (grouped by status: Live → Upcoming → Final, or by
  time). CHL filtered to sub-league.
- **Whitespace fill:** if slate is small/empty, append a compact standings snippet or news ("Around the
  {league}") — sacrificable content, only when it fits.
- Tap game → **Game Detail**. Tap team logo/name → **Team Hub**.
- States: offseason ("No games — season starts {date}"), empty day, error.
- APIs: `/scores`, `/ahl-scores`, `/chl-scores`, `/ncaa-scores`; `/next-team-games` for My Teams.

### 6.2 Game Detail (push, ✅)
- Collapsing hero: teams, logos, score, period linescore, SOG, status/clock (LIVE dot).
- Segmented: **Scoring** (goals w/ assists, type badges → player), **Penalties**, **Rosters** (away/home
  skaters+goalies), **Preview/At-a-Glance** (three stars, AI preview for upcoming).
- **Live polling** while LIVE / today-UPCOMING (see §9). Series info banner in playoffs.
- API: `/game/{gameId}` (+ `/game/{id}/preview`).

### 6.3 Standings (tab, ✅)
- League/conference picker. Table via `StandingsRow` (NHL/AHL/CHL) or `NcaaStandingsRow` (NCAA).
- Grouping: by division (NHL/AHL/CHL) or conference (NCAA); segmented sub-view for **League / Division /
  Wildcard** where applicable.
- 🕒 **Playoffs/Bracket** toggle when in postseason (`/nhl-playoffs`, `/ahl-playoffs`,
  `/chl-playoffs/{league}`, `/ncaa-tournament`).
- Tap row → **Team Hub**. APIs per §5.

### 6.4 Stats / Leaders (tab, ✅)
- League picker + Skaters/Goalies segmented control.
- `StatLeaderRow` list (rank, player, team, key stat columns). Tap → player (NHL) / team.
- 🕒 sortable columns / category picker. APIs: `/nhl-stats`, `/ahl-stats`, `/chl-stats/{league}`,
  `/ncaa-stats`.

### 6.5 Teams (tab, ✅)
- League picker + **search bar** (teams + players).
- Grid/list of teams for the league (`/all-teams` filtered, or per-league directory). Favorites pinned.
- Tap → **Team Hub**; search player result → **Player Detail**.

### 6.6 Team Hub (push, ✅)
- Hero: logo, name, record, rank, **location/arena**, next/last game (with dates), **★ favorite**.
- Segmented sub-nav (league-aware — see §4):
  - **Home** ✅ — leaders, last-5 / next-10, division/conf standings snippet. (`/team/{id}/home`, etc.)
  - **Schedule** ✅ — full season list, result/status. (`/team/{id}/schedule`)
  - **Roster** ✅ — forwards/defense/goalies tables. (`/team/{id}/roster`)
  - **Stats** ✅ — team stat splits. (`/team/{id}/stats`)
  - **Prospects** 🕒 (NHL only) — org depth + contracts. (`/team/{id}/organization`)
- Handles all id formats via league detection (already in `lib/api.ts`).

### 6.7 Player Detail (push, ✅ NHL / graceful stub others)
- Bio (headshot, #, pos, shoots, ht/wt, born+age, birthplace+flag, draft, contract).
- Current-season stat line + career history table (tabbed leagues). Non-NHL → "Player pages coming soon".
- API: `/player/{playerId}`.

### 6.8 More (tab, ✅ shell)
- **Favorites** ✅ (manage starred teams), **Schedules** 🕒 (personalized multi-league calendar,
  `/schedules` equivalent), **Playoffs/Brackets** 🕒, **Draft hub** 🕒, **Settings** ✅ (theme, density,
  about/legal — `/about`, `/privacy`, `/terms`, `/credits`).
- 🕒 **Device sync** (pairing) once accounts exist — deferred (read-only v1).

### 6.9 Explicitly deferred / sacrificed for v1
News (surface only as whitespace filler, not a destination), free-agency tracker, off-season moves card,
live ticker, multi-device sync, NCAA/CHL player detail pages (API unsupported), full search UI.

---

## 7. Design System

- **Type:** SF Pro (system). Large titles on tab roots; `title2/headline/subheadline/footnote` scale.
  Tabular figures (`fontVariant: ['tabular-nums']`) for scores/records. Dynamic Type enabled.
- **Color (semantic, dark-mode-native):**
  - Backgrounds: `systemBackground` / `secondarySystemBackground` / grouped for tables.
  - Text: `label` / `secondaryLabel` / `tertiaryLabel`.
  - Accent: **omni blue `#208AEF`**. LIVE = system red. Team color as contextual hero accent.
  - Separators: hairline `separator`. Materials for tab bar + sticky headers.
- **Iconography:** **SF Symbols** throughout (`expo-symbols`) — replaces the current PNG tab icons.
- **Logos:** shared `TeamLogo` — resolves site-relative overrides against origin, scales NHL SVGs 1.5×
  (already built). Add a per-league fallback monogram when a logo URL is missing/broken.
- **Core components (to standardize in `src/components/`):**
  `GameCard`, `TeamRow`, `StandingsRow` / `NcaaStandingsRow`, `StatLeaderRow`, `PlayerBioHeader`,
  `SegmentedControl`, `LeaguePicker` (w/ conference sheet), `TeamLogo`, `SectionHeader`, `FavoriteStar`,
  `StateView` (loading/empty/error/offseason), `DateBar`.
- **Spacing:** 4-pt grid; 16 screen margins; 12–14 card radius; hairline borders.

---

## 8. Adaptive Density & iPad

- **Priority tiers:** (1) primary data always; (2) secondary (extended leaders, standings snippet on
  Scores) when it fits; (3) tertiary (news) only as whitespace filler / on iPad.
- **iPhone:** single column. Below-the-fold space on short slates → tier-2/3 fillers.
- **iPad / regular width:** **split layouts** — Scores list ‖ selected Game Detail; Teams list ‖ Team
  Hub; Standings full-width with wider tables. Use size-class detection to switch. This is where news and
  extended content earn their place.

---

## 9. Data Layer

- **Client:** keep `src/lib/api.ts` as the typed base; add typed fetchers per endpoint (normalizers like
  `fetchStandings` already model this).
- **Caching / fetching lib:** adopt **TanStack Query (React Query)** — gives caching, dedupe,
  stale-while-revalidate, and `refetchInterval` for live games in one place. *(Proposed — see §12.)*
- **Live polling:** Game Detail + live Scores poll every **15s** while `LIVE` or today-`UPCOMING`; pause
  on `AppState` background; resume on focus.
- **Offseason:** consult a league-calendar (mirror `omni-hockey/lib/league-calendar.ts`) to skip dead
  fetches and show "season starts {date}" instead of empty lists.
- **Favorites (local-first + optional pairing sync):** `AsyncStorage` is the on-device source of truth
  (team ids with league prefix, e.g. `ahl-114`) — no login required. **Opt-in device pairing** reuses the
  web's existing "generate code" flow (`/api/sync/pair/create` → 6-digit code, `/api/sync/pair/claim`,
  `/api/sync/preferences`) to **pull/merge** favorites + theme from the web account. Merge strategy:
  union of team sets on claim; local stays authoritative offline. Keeps v1 login-free.
- **Types:** continue the copied subset in `src/lib/types.ts`; extract a shared `@omni/types` package
  later (tracked separately).

---

## 10. States (must-handle)

Loading (skeleton/spinner) · Empty day · **Offseason** (with start date) · Partial data (missing stats →
"—") · Error (retry) · Offline · Unsupported (non-NHL player → "coming soon"). All via one `StateView`.

---

## 11. Native Fast-Follow (designed-for, not in v1)

- **Push** (favorite-team game start / goals / final): `expo-notifications` + APNs + a token-registration
  endpoint on omni-hockey (**API addition needed**) + a send service.
- **Live Activities / Dynamic Island** (in-progress score): ActivityKit via a native widget extension
  (config plugin or bare workflow) + push-to-update.
- **Home-screen widgets** (next game / live score): WidgetKit extension.
- Prereqs: **$99/yr Apple Developer Program**, EAS build, server push infra. Store favorites in a way
  that a server can read (sync) so pushes can target them.

---

## 12. Decisions (resolved 2026-07-28)

1. **Data lib:** ✅ **TanStack Query (React Query)** for caching + 15s live polling.
2. **Favorites:** ✅ **Local-first (AsyncStorage)** + **optional device pairing** to sync from the web via
   the existing "generate code" flow (see §9). Login-free v1.
3. **Min iOS:** ✅ **17+**.
4. **Tab set:** ✅ **Scores / Standings / Stats / Teams / More** (favorites + search cross-cutting).
5. **iPad:** ✅ **Phone-first**, iPad split-view polish in Phase 4 (still a universal build).

---

## 13. Phased Build Roadmap

- **Phase 0 — Scaffold (done):** API wiring, `TeamLogo`, first league switcher, build/codesign green.
- **Phase 1 — Foundation (next):** design system + `StateView`/components; SF Symbols tab bar; **global
  LeaguePicker** with CHL split + NCAA conference sheet; native theming; rebuild Scores/Standings/Stats/
  Teams on the new shell. *(Absorbs the current one-off screens.)*
- **Phase 2 — Detail depth:** Team Hub (Home/Schedule/Roster/Stats), Game Detail (+live polling), Player
  Detail.
- **Phase 3 — Breadth:** Favorites + My Teams strip, Search, Settings/More, offseason handling, NCAA
  standings layout, Prospects (NHL).
- **Phase 4 — Ship read-only v1:** iPad layouts, Dynamic Type/VoiceOver, empty/error polish, app icon +
  screenshots + privacy → **App Store submit**.
- **Phase 5 — Native fast-follow:** push, widgets, Live Activities, device sync.

---

## 14. Known Data / Asset Issues (track, fix in Phase 1)

- **Missing team logos** for some teams (e.g., **Wenatchee Wild** WHL, and CHL teams on relative override
  paths). Mitigations: origin-resolve relative paths (done); add **monogram fallback** in `TeamLogo`;
  file gaps back to omni-hockey for real assets.
- **NCAA standings** need the dedicated W-L-T layout (§5).
- **CHL scores** must filter the combined feed by sub-league (§5).

---

## 15. App Store Readiness (v1 checklist)

Read-only + no login avoids Apple's account/sign-in-with-Apple and account-deletion requirements. Still
need: no dev/test screens, no broken links, graceful offline, privacy policy + data-collection
disclosure (minimal — no PII in v1), app icon + launch screen, iPhone + iPad screenshots, HIG-compliant
navigation, and age rating. Confirm no unapproved external-payment or web-view-wrapper patterns.
