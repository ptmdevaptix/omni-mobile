// How far off a future game is, for the little squares in a card's corner. Mirrors lib/days-out.ts
// on the web. Counted in calendar days on the reader's own clock — the same day the card's time is
// shown in — so a game at 10 PM tonight is "today" and one at 12:30 AM tomorrow is one day out.
import { daysBetween } from './format';

export type DaysOut = { days: number; weeks: number; rem: number };

export function daysOut(today: string, day: string): DaysOut | null {
  const days = daysBetween(today, day);
  if (days <= 0) return null;
  return { days, weeks: Math.floor(days / 7), rem: days % 7 };
}

/** Past this many weeks the squares stop and a count takes over — a season's worth of squares is noise. */
export const MAX_WEEK_SQUARES = 8;

export function daysOutLabel(d: DaysOut): string {
  if (d.days === 1) return 'Tomorrow';
  if (d.weeks === 0) return `In ${d.days} days`;
  const w = `${d.weeks} week${d.weeks === 1 ? '' : 's'}`;
  return d.rem ? `In ${d.days} days (${w}, ${d.rem} day${d.rem === 1 ? '' : 's'})` : `In ${w}`;
}
