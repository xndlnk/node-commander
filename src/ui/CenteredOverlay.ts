import { Box } from 'ink';
import { html } from './html.ts';

type Props = { width: number; height: number; children: unknown };

// Floats its children centered over whatever is already on screen. Uses
// position="absolute" so the panes underneath stay visible; the empty area
// around the child emits nothing. Note that Ink boxes are transparent — a
// child that wants to hide the panes behind it must paint every interior cell
// itself (MenuDialog does this with an opaque space backdrop), otherwise the
// panes bleed through the gaps.
export function CenteredOverlay({ width, height, children }: Props) {
  return html`
    <${Box}
      position="absolute"
      width=${width}
      height=${height}
      justifyContent="center"
      alignItems="center"
    >
      ${children}
    </${Box}>
  `;
}
