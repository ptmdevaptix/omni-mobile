# Omni Hockey — mobile (Expo)

Native iOS/iPad (and Android) app for Omni Hockey. It's a **client of the existing omni-hockey API** —
the web repo (`../omni-hockey`) is the single backend/source of truth. This app renders the same live
data (`https://omnihockey.com/api/*`) with native UI.

## Run it

```bash
npm install
npx expo start           # then press `i` for the iOS simulator, or scan the QR with Expo Go on a device
npx expo start --ios     # boot the iOS simulator directly (needs Xcode)
```

iPad is enabled (`ios.supportsTablet`, rotation on). A native build (for TestFlight / App Store / push
notifications) uses EAS: `npx eas build -p ios` — that step requires the $99/yr Apple Developer Program.

## What's here (scaffold)

- **Expo Router** (file-based routes under `src/app`), TypeScript, light/dark.
- Root `Stack` → `(tabs)` (**Scores**, **Standings**) + a pushed `teams/[teamId]` detail screen.
- `src/lib/api.ts` — thin fetch client over the production API + per-league team-id → endpoint mapping
  (mirrors the web app's league detection: NHL bare abbr; AHL/CHL/NCAA/USHL prefixed).
- `src/lib/types.ts` — minimal response types for the endpoints used (copied subset).
- Live wiring: Scores (`/scores`), Standings (`/nhl-standings`), Team header (`/team`, `/ncaa-team`, …),
  with pull-to-refresh and tap-through to a team. NCAA "points" are hidden (as on the web).

## Layout

```
src/
  app/
    _layout.tsx              root Stack + theme + splash
    (tabs)/_layout.tsx       tab bar
    (tabs)/index.tsx         Scores
    (tabs)/standings.tsx     Standings (NHL; league switcher is an easy next step)
    teams/[teamId].tsx       Team detail (any league)
  lib/ { api, types, theme }
```

The starter template's demo components under `src/components`, `src/constants`, `src/hooks` are unused
(replaced by the above) and can be deleted whenever.

## Suggested next steps

1. **Share types properly.** Instead of copying, extract `omni-hockey/lib/*-types.ts` into a small
   `@omni/types` package both repos consume, so the API contract stays in sync.
2. **Harden the API** on the web side (an app token + rate limiting) since it's now a public contract for
   two clients.
3. **Native value-adds** (the reason to be in the App Store): push notifications for favorite teams and a
   Live Activity for in-progress game scores.
4. **Favorites**: port the web app's localStorage favorites to `AsyncStorage` (+ optional Supabase sync).
5. **EAS Update** for over-the-air JS/UI updates without App Store review.
