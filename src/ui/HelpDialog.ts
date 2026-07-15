import { Box, Text, useInput } from 'ink';
import stringWidth from 'string-width';
import type { MenuItem } from '../types.ts';
import { html } from './html.ts';

type Props = {
  width: number;
  items: MenuItem[];
  onClose: () => void;
};

// Built-in keybindings, grouped. Each row is [fkey, letter, action]; either of
// the first two may be empty. Kept in sync by hand with StatusBar, the input
// handlers, and the README (see the plan's "4th place" trade-off).
const BINDINGS: { group: string; rows: [string, string, string][] }[] = [
  {
    group: 'Navigation',
    rows: [
      ['Tab', '', 'Switch pane'],
      ['↑ ↓', '', 'Move cursor'],
      ['PgUp/PgDn', '', 'Page cursor'],
      ['Enter', '', 'Open dir / .. up / file'],
    ],
  },
  {
    group: 'Actions',
    rows: [
      ['F1', '', 'Help'],
      ['F2', 'u', 'User menu'],
      ['F3', 'v', 'View'],
      ['F4', 'e', 'Edit'],
      ['F5', 'c', 'Copy'],
      ['F6', 'm', 'Move'],
      ['F7', 'n', 'MkDir'],
      ['F8', 'd', 'Delete'],
      ['', 'r', 'Rename'],
      ['', 's', 'Size'],
      ['F10', 'q', 'Quit'],
    ],
  },
];

// F-key column is wide enough for "PgUp/PgDn"; letter column is one glyph.
const FKEY_COL = 9;
const LETTER_COL = 1;

// F1 keybindings help overlay. Presentational but owns its own input (Esc /
// Enter / any character closes). Modeled on MenuDialog: same opaque
// space-backdrop and `line()` column-clamp so the panes never bleed through and
// no row wraps. See overlay.test.js / help.test.js for the no-bleed assertion.
export function HelpDialog({ width, items, onClose }: Props) {
  useInput((input, key) => {
    // Close on any key — Esc, Enter, arrows/paging, Tab, or any character. The
    // one press to ignore is the swallowed F1 keypress that opened us: Ink
    // delivers it as input === '' with every key flag false, so requiring at
    // least one signal (a character or a set flag) drops it (the F1 toggle in
    // useFKeys handles closing instead).
    const navKey =
      key.escape ||
      key.return ||
      key.upArrow ||
      key.downArrow ||
      key.leftArrow ||
      key.rightArrow ||
      key.pageUp ||
      key.pageDown ||
      key.tab;
    if (navKey || input) onClose();
  });

  const boxWidth = Math.min(width, 60);
  const inner = boxWidth - 2;

  // Leading space for a left margin, clamped in display columns to leave a right
  // margin so Ink never wraps the line into an uncovered extra row.
  const line = (s: string) => {
    let out = ' ';
    let w = 1;
    for (const ch of s) {
      const cw = stringWidth(ch);
      if (w + cw > inner - 1) break;
      out += ch;
      w += cw;
    }
    return out;
  };

  const pad = (s: string, n: number) => {
    const gap = n - stringWidth(s);
    return gap > 0 ? s + ' '.repeat(gap) : s;
  };

  // A built-in binding row: aligned fkey + letter + action columns.
  const bindingText = ([fkey, letter, action]: [string, string, string]) =>
    `${pad(fkey, FKEY_COL)} ${pad(letter, LETTER_COL)} ${action}`;

  const rows: unknown[] = [];
  for (const { group, rows: groupRows } of BINDINGS) {
    rows.push(
      html`<${Text} key=${`g-${group}`} bold>${line(group)}</${Text}>`,
    );
    for (const r of groupRows) {
      rows.push(
        html`<${Text} key=${`${group}-${r[2]}`}>${line(bindingText(r))}</${Text}>`,
      );
    }
  }

  if (items.length > 0) {
    rows.push(html`<${Text} key="custom" bold>${line('Custom (menu.json)')}</${Text}>`);
    items.forEach((it, i) => {
      const key = it.key ? it.key : ' ';
      const direct = it.direct ? ' ⟨direct⟩' : '';
      rows.push(
        html`<${Text} key=${`c-${i}`}>${line(`${pad(key, LETTER_COL)}  ${it.label}${direct}`)}</${Text}>`,
      );
    });
  }

  // One space-line per content row: title + rows + footer hint.
  const contentRows = 1 + rows.length + 1;
  const backdrop = Array.from(
    { length: contentRows },
    (_, i) => html`<${Text} key=${`bg-${i}`}>${' '.repeat(inner)}</${Text}>`,
  );

  return html`
    <${Box}
      flexDirection="column"
      width=${boxWidth}
      borderStyle="round"
      borderColor="magenta"
    >
      <${Box} position="absolute" flexDirection="column">${backdrop}</${Box}>
      <${Text} color="magenta" bold>${line('Keybindings')}</${Text}>
      ${rows}
      <${Text} dimColor>${line('Esc / any key to close')}</${Text}>
    </${Box}>
  `;
}
