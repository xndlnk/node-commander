import { Box, Text } from 'ink';
import type { Entry } from '../types.ts';
import { formatSize, formatDate, padName, padLeft } from '../util/format.ts';
import { html } from './html.ts';

// Center-clamp windowing (per disk-reclaim): keep the cursor roughly centered,
// clamped so we never scroll past either end. Returns the first visible index.
export function windowFor(cursor: number, total: number, height: number): number {
  if (total <= height) return 0;
  let start = cursor - Math.floor(height / 2);
  if (start < 0) start = 0;
  if (start > total - height) start = total - height;
  return start;
}

const SIZE_COL = 9;
const DATE_COL = 16;

type Props = {
  entries: Entry[];
  cursor: number;
  height: number;
  width: number;
  active: boolean;
};

export function FileList({ entries, cursor, height, width, active }: Props) {
  const total = entries.length;
  const start = windowFor(cursor, total, height);
  const visible = entries.slice(start, start + height);
  // name column = total width minus size/date columns and two single-space gaps.
  const nameWidth = Math.max(4, width - SIZE_COL - DATE_COL - 2);

  const rows = visible.map((entry, i) => {
    const index = start + i;
    const isCursor = index === cursor;
    const sizeText =
      entry.isDir && !entry.sizeComputed ? '<DIR>' : formatSize(entry.size);
    const dateText = entry.mtime.getTime() === 0 ? '' : formatDate(entry.mtime);
    const line = `${padName(entry.name, nameWidth)} ${padLeft(sizeText, SIZE_COL)} ${padLeft(dateText, DATE_COL)}`;

    return html`
      <${Text}
        key=${index}
        inverse=${isCursor && active}
        color=${entry.isDir ? 'cyan' : undefined}
        dimColor=${isCursor && !active}
      >${line}</${Text}>
    `;
  });

  // Pad with blank rows so the pane always fills its full height, regardless of
  // how many entries the directory holds.
  for (let i = visible.length; i < height; i++) {
    rows.push(html`<${Text} key=${`pad-${i}`}> </${Text}>`);
  }

  return html`<${Box} flexDirection="column">${rows}</${Box}>`;
}
