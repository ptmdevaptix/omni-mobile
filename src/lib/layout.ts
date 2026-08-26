// Adaptive layout for the universal (iPhone + iPad) app.
//
// Everything here keys off the WINDOW size, never the device: Stage Manager, Slide Over and split
// multitasking all hand an iPad app a phone-width window, and they resize it live. `Platform.isPad`
// would happily render a 3-column grid into a 320pt Slide Over sliver.
import { useWindowDimensions } from 'react-native';

import { RAIL_WIDTH, RAIL_WIDTH_COLLAPSED, useSidebar } from './sidebar';

// Where the layout stops being a phone. 700 clears iPad portrait split-view halves (507pt on a 13")
// so those keep the phone layout, and catches every full-screen iPad including the mini (744pt).
const REGULAR = 700;
const WIDE = 1080;

export type Layout = {
  /**
   * Width the *content* gets — the window minus the side rail on iPad. Screens must size against
   * this, never the raw window: a table budgeted against the window overflows behind the rail.
   */
  width: number;
  height: number;
  /** iPad-sized window (iOS "regular" width, roughly). */
  regular: boolean;
  /** Big window — full-screen 11"/13" landscape. */
  wide: boolean;
  /** Cards across the content column for full-size game cards. */
  cols: number;
  /** Card-grid column cap. Grids center inside this instead of stretching to 1366pt. */
  maxWidth: number;
  /**
   * Tighter cap for text and tables. The phone app's proportions are what make it feel like an app
   * rather than a web page, and a 1280pt-wide paragraph or a stretched table breaks that.
   */
  readWidth: number;
  /** Content padding — roomier on iPad. */
  gutter: number;
  /** Portrait/landscape, for the screens that care. */
  landscape: boolean;
};

export function useLayout(): Layout {
  const { width: windowWidth, height } = useWindowDimensions();
  const { collapsed } = useSidebar();

  // Whether the rail shows at all is a question about the window; everything after it is about the
  // content column left over once the rail has taken its cut.
  const regular = windowWidth >= REGULAR;
  const rail = regular ? (collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH) : 0;
  const width = windowWidth - rail;
  const wide = width >= WIDE;

  return {
    width,
    height,
    regular,
    wide,
    cols: wide ? 3 : regular ? 2 : 1,
    maxWidth: wide ? 1280 : regular ? 900 : width,
    readWidth: wide ? 1040 : regular ? 860 : width,
    gutter: regular ? 20 : 12,
    landscape: windowWidth > height,
  };
}

// Game cards per row. Compact mode is a density *bump* on top of the layout, not a separate mode:
// one more column on iPad, the existing 2-up grid on a phone.
export function gameColumns(l: Layout, compact: boolean): number {
  if (!l.regular) return compact ? 2 : 1;
  return compact ? l.cols + 1 : l.cols;
}

// Chunk a list into rows of `per`, so a lone trailing card keeps its column width instead of
// stretching across the row like FlatList's numColumns would.
export function toRows<T>(items: T[], per: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += per) rows.push(items.slice(i, i + per));
  return rows;
}

// Style for a list's contentContainer (or a plain View) that caps and centers the content column.
export function centered(l: Layout, extra?: { padding?: number }) {
  return {
    width: '100%' as const,
    maxWidth: l.maxWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: extra?.padding ?? l.gutter,
  };
}
