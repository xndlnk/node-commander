import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import type { Modal } from '../types.ts';
import { html } from './html.ts';

// Renders the active modal overlay. Input routing for the dialog lives in
// App.ts (it owns useInput); this component is presentational.
type Props = {
  modal: Modal;
};

type Row = { node: unknown; width: number };

// Ink boxes are transparent: only the border and the glyphs each child writes
// are painted, so the empty cells inside the border let the panes underneath
// bleed through (see MenuDialog for the full story). We can't rely on padding
// each line to full width because Ink is internally inconsistent about the
// column width of ambiguous glyphs. Instead, size the box to its widest line and
// paint an opaque backdrop of plain spaces (unambiguously one column each) behind
// the rows — one space-line per row — so every interior cell is covered.
function Panel({ color, rows }: { color: string; rows: Row[] }) {
  const maxW = rows.reduce((m, r) => Math.max(m, r.width), 0);
  const inner = maxW + 2; // one-column margin on each side, replacing paddingX
  const backdrop = Array.from(
    { length: rows.length },
    (_, i) => html`<${Text} key=${`bg-${i}`}>${' '.repeat(inner)}</${Text}>`,
  );
  // Each row is a natural-width node given a one-column left margin; the backdrop
  // fills the remainder (including the right margin). Because the box is exactly
  // as wide as the widest row, no row wraps, so the row count stays fixed and the
  // backdrop always matches.
  return html`
    <${Box} flexDirection="column" width=${inner + 2} borderStyle="round" borderColor=${color}>
      <${Box} position="absolute" flexDirection="column">${backdrop}</${Box}>
      ${rows.map(
        (r, i) => html`<${Box} key=${i}><${Text}> </${Text}>${r.node}</${Box}>`,
      )}
    </${Box}>
  `;
}

export function Dialog({ modal }: Props) {
  if (modal.type === 'confirm') {
    const hint = 'Enter / y = yes    Esc / n = no';
    const rows: Row[] = [
      { node: html`<${Text} color="yellow" bold>Confirm</${Text}>`, width: stringWidth('Confirm') },
      { node: html`<${Text}>${modal.message}</${Text}>`, width: stringWidth(modal.message) },
      { node: html`<${Text} dimColor>${hint}</${Text}>`, width: stringWidth(hint) },
    ];
    return html`<${Panel} color="yellow" rows=${rows} />`;
  }

  if (modal.type === 'input') {
    const hint = 'Enter = submit    Esc = cancel';
    const rows: Row[] = [
      { node: html`<${Text} color="cyan" bold>${modal.label}</${Text}>`, width: stringWidth(modal.label) },
      {
        // "❯ " prompt (2) + value + the inverse cursor cell (1).
        node: html`
          <${Box}>
            <${Text}>❯ </${Text}>
            <${Text}>${modal.value}</${Text}>
            <${Text} inverse> </${Text}>
          </${Box}>
        `,
        width: 2 + stringWidth(modal.value) + 1,
      },
      { node: html`<${Text} dimColor>${hint}</${Text}>`, width: stringWidth(hint) },
    ];
    return html`<${Panel} color="cyan" rows=${rows} />`;
  }

  return null;
}
