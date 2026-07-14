import React from 'react';
import { Box, Text, useInput } from 'ink';
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

  const rows =
    items.length === 0
      ? [
          html`<${Text} key="empty" dimColor>No menu entries.</${Text}>`,
          html`<${Text} key="hint" dimColor>${reason ?? ''}</${Text}>`,
          html`<${Text} key="path" dimColor>Create ${path} to add scripts.</${Text}>`,
        ]
      : items.map((it, i) => {
          const selected = i === cursor;
          const hotkey = it.key ? `[${it.key}] ` : '    ';
          const direct = it.direct ? ' ⟨direct⟩' : '';
          return html`
            <${Text} key=${i} inverse=${selected}>${hotkey}${it.label}${direct}</${Text}>
          `;
        });

  return html`
    <${Box}
      flexDirection="column"
      width=${Math.min(width, 60)}
      borderStyle="round"
      borderColor="magenta"
      paddingX=${1}
    >
      <${Text} color="magenta" bold>User menu</${Text}>
      ${rows}
      ${(warnings ?? []).map(
        (w, i) => html`<${Text} key=${`warn-${i}`} color="yellow">⚠ ${w}</${Text}>`,
      )}
      <${Text} dimColor>↑↓ + Enter or hotkey • Esc to cancel</${Text}>
    </${Box}>
  `;
}
