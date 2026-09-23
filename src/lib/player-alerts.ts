/**
 * What a reader wants to hear about a person they follow — see docs/design/player-alerts.md in the web repo.
 *
 * A club's alerts are the game's events. A person's are his own: he dressed, he scored, he took a
 * penalty, here is how it ended for him. The difference is not a preference, it is the point —
 * sending a prospect's follower every goal in his club's game is how one switch becomes forty
 * notifications a night.
 */

export const PERSON_EVENTS = ["dressed", "entered", "goal", "assist", "penalty", "final"] as const;
export type PersonEvent = (typeof PERSON_EVENTS)[number];

export type PersonAlerts = Record<PersonEvent, boolean>;

/**
 * A player starred BY NAME: everything. The reader picked him out of every player there is, so his
 * night is what they asked for.
 */
export const STARRED_DEFAULT: PersonAlerts = {
  dressed: true, entered: true, goal: true, assist: true, penalty: true, final: true,
};

/**
 * A whole org's prospects: quiet. One switch can stand for forty people across six leagues, so it
 * defaults to the three events worth waking a phone for and nothing else. A prospect worth more
 * than that can be starred by name, which is the loud subscription.
 */
export const PROSPECT_DEFAULT: PersonAlerts = {
  dressed: false, entered: false, goal: true, assist: true, penalty: false, final: true,
};

/** A stored (possibly partial, possibly absent) switch set, filled in from its kind's default. */
export function resolveAlerts(
  stored: unknown,
  kind: "starred" | "prospect",
): PersonAlerts {
  const base = kind === "starred" ? STARRED_DEFAULT : PROSPECT_DEFAULT;
  const raw = (stored ?? {}) as Record<string, unknown>;
  const out = {} as PersonAlerts;
  for (const e of PERSON_EVENTS) out[e] = typeof raw[e] === "boolean" ? (raw[e] as boolean) : base[e];
  return out;
}

/** Only the switches that differ from the default, so a device stores and sends the exceptions. */
export function alertOverrides(alerts: PersonAlerts, kind: "starred" | "prospect"): Partial<PersonAlerts> {
  const base = kind === "starred" ? STARRED_DEFAULT : PROSPECT_DEFAULT;
  const out: Partial<PersonAlerts> = {};
  for (const e of PERSON_EVENTS) if (alerts[e] !== base[e]) out[e] = alerts[e];
  return out;
}
