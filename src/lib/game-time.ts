/**
 * How a game's start time is written, everywhere one is shown — score cards, the scoreboard strip,
 * next-game cards, schedules, the game page — so they cannot drift apart. The web has the same
 * helper (omni-hockey lib/game-time.ts), and the two must agree.
 *
 * Two modes, the reader's choice (src/lib/time-zone-mode, synced across devices):
 *   "mine"  — in the reader's own time zone, no zone written: "7:00 PM". The default, and what the
 *             site always did; a section note says the times are theirs.
 *   "arena" — in the time zone of the rink it is played in, zone written: "7:00 PM PT". Written out
 *             because a slate mixes zones, and a bare "7:00 PM" beside another would read as the same
 *             hour. A game whose feed does not say where it is (NCAA, ECHL) shows the reader's own
 *             time with the reader's zone written — still unambiguous, just not the rink's.
 */

export type TimeZoneMode = "mine" | "arena";

// North American zones are named the way broadcasters and schedules name them — "ET", not "EDT" or
// "EST" — so the label does not change twice a year. Elsewhere the zone's own short name ("CEST").
const NA_ZONE: Record<string, string> = {
  EST: "ET", EDT: "ET", CST: "CT", CDT: "CT", MST: "MT", MDT: "MT", PST: "PT", PDT: "PT",
  AST: "AT", ADT: "AT", NST: "NT", NDT: "NT", AKST: "AKT", AKDT: "AKT", HST: "HT", HDT: "HT",
};

function shortZoneName(timeZone: string | undefined, at: Date, locale: string): string | undefined {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
      .formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  } catch {
    return undefined;
  }
}

/** "ET", "PT", "CEST" — the zone as it is written after a time. `timeZone` undefined = the reader's. */
export function zoneLabel(timeZone: string | undefined, at: Date = new Date()): string {
  const us = shortZoneName(timeZone, at, "en-US");
  if (us && NA_ZONE[us]) return NA_ZONE[us];
  const gb = shortZoneName(timeZone, at, "en-GB");
  return gb ?? us ?? "";
}

/** Is this a zone Intl can format in? A feed's odd value must not throw inside a render. */
function validZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone }); return true; } catch { return false; }
}

/**
 * A start time as the reader asked for it. `compact` drops ":00"–":09" minutes to "7PM", as the
 * narrow cards always have.
 */
export function formatGameTime(
  utcIso: string,
  { mode = "mine", venueTimeZone, compact = false }: { mode?: TimeZoneMode; venueTimeZone?: string; compact?: boolean } = {},
): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return "";
  const arena = mode === "arena";
  const timeZone = arena && validZone(venueTimeZone) ? venueTimeZone : undefined;
  const minutes = Number(new Intl.DateTimeFormat("en-US", { timeZone, minute: "numeric" }).format(d));
  const time = compact && minutes < 10
    ? new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: true }).format(d).replace(/\s/g, "")
    : new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return arena ? `${time} ${zoneLabel(timeZone, d)}` : time;
}

/** The section note that goes with the mode: whose clock the times on the page are on. */
export function timeModeNote(mode: TimeZoneMode): string {
  return mode === "arena" ? "Times at each arena" : "Times in your time zone";
}
