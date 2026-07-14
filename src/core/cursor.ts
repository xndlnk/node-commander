import type { Entry } from '../types.ts';

// How to place the cursor when (re)loading a directory into a pane.
export type CursorHint = {
  keepName?: string; // put the cursor on the entry with this name, if present
  keepCursor?: number; // otherwise hold this index, clamped to the listing
};

// Decide the cursor index for a freshly loaded listing. Preference order:
//   1. keepName — land on that entry if it still exists (survives reordering),
//   2. keepCursor — hold the same position, clamped into range,
//   3. fall back to the top (0).
// An empty listing always resolves to 0.
export function resolveCursor(entries: Entry[], hint: CursorHint = {}): number {
  if (entries.length === 0) return 0;
  if (hint.keepName !== undefined) {
    const i = entries.findIndex((e) => e.name === hint.keepName);
    if (i >= 0) return i;
  }
  if (hint.keepCursor !== undefined) {
    return Math.max(0, Math.min(hint.keepCursor, entries.length - 1));
  }
  return 0;
}
