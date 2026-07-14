import { Box } from 'ink';
import { html } from './html.ts';

type Props = { width: number; height: number; children: unknown };

// Floats its children centered over whatever is already on screen. Uses
// position="absolute" so the panes underneath stay visible (Ink composites the
// opaque child box over them; the empty area around it emits nothing).
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
