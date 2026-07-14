import React from 'react';
import { Box, Text, useInput } from 'ink';
import stringWidth from 'string-width';
import type { MenuItem } from '../types.ts';
import { html } from './html.ts';

const { useState } = React;

type Props = {
  width: number;
  items: MenuItem[];
  path: string;
  reason?: string;
  warnings?: string[];
  onSelect: (item: MenuItem) => void;
  onClose: () => void;
};

// F2 user menu: lists configured scripts. Owns its own input (arrows + Enter,
// per-entry hotkey, Esc to cancel) so App can stay out of the routing. The menu
// is loaded once in App and passed in as props.
export function MenuDialog({ width, items, path, reason, warnings, onSelect, onClose }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (items.length === 0) return;
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(items.length - 1, c + 1));
    } else if (key.return) {
      onSelect(items[cursor]!);
    } else if (input) {
      const idx = items.findIndex((it) => it.key === input);
      if (idx >= 0) onSelect(items[idx]!);
    }
  });

  // Ink boxes are transparent: only the border and the glyphs each child writes
  // land on screen, so the empty cells inside the border let the panes underneath
  // bleed through. We can't fix this by padding each line to full width, because
  // Ink is internally inconsistent about the column width of ambiguous glyphs
  // (e.g. it lays ⚠ out as 2 columns but its renderer advances it as 1), so no
  // per-line padding is exactly right — it leaves a stray column or wraps.
  //
  // Instead we paint an opaque backdrop of plain spaces (all unambiguously one
  // column) behind the content, one space-line per content row. Each content line
  // is clamped so it can never wrap; that keeps the rendered row count equal to
  // the backdrop's, so every interior cell is covered no matter the glyph widths.
  const boxWidth = Math.min(width, 60);
  const inner = boxWidth - 2;

  // Leading space for a left margin, clamped to leave a right margin. Clamping in
  // display columns (string-width) guarantees the line stays narrower than the
  // interior, so Ink never wraps it into an uncovered extra row.
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

  const rows =
    items.length === 0
      ? [
          html`<${Text} key="empty" dimColor>${line('No menu entries.')}</${Text}>`,
          html`<${Text} key="hint" dimColor>${line(reason ?? '')}</${Text}>`,
          html`<${Text} key="path" dimColor>${line(`Create ${path} to add scripts.`)}</${Text}>`,
        ]
      : items.map((it, i) => {
          const selected = i === cursor;
          const hotkey = it.key ? `[${it.key}] ` : '    ';
          const direct = it.direct ? ' ⟨direct⟩' : '';
          return html`
            <${Text} key=${i} inverse=${selected}>${line(`${hotkey}${it.label}${direct}`)}</${Text}>
          `;
        });

  const warningRows = (warnings ?? []).map(
    (w, i) => html`<${Text} key=${`warn-${i}`} color="yellow">${line(`⚠ ${w}`)}</${Text}>`,
  );

  // One space-line per content row: header + entries + warnings + hint.
  const contentRows = 1 + rows.length + warningRows.length + 1;
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
      <${Text} color="magenta" bold>${line('User menu')}</${Text}>
      ${rows}
      ${warningRows}
      <${Text} dimColor>${line('↑↓ + Enter or hotkey • Esc to cancel')}</${Text}>
    </${Box}>
  `;
}
