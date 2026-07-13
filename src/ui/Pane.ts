import { Box, Text } from 'ink';
import type { PaneState } from '../types.ts';
import { FileList } from './FileList.ts';
import { truncateMiddle } from '../util/format.ts';
import { html } from './html.ts';

type Props = {
  pane: PaneState;
  active: boolean;
  height: number;
  width: number;
};

export function Pane({ pane, active, height, width }: Props) {
  // width includes the border; inner content is width - 2.
  const inner = Math.max(4, width - 2);
  const header = truncateMiddle(pane.cwd, inner);
  const current = pane.entries[pane.cursor];
  const footer = current ? current.name : '';

  return html`
    <${Box}
      flexDirection="column"
      width=${width}
      borderStyle="single"
      borderColor=${active ? 'cyan' : 'gray'}
    >
      <${Box} width=${inner}>
        <${Text} bold color=${active ? 'cyan' : 'white'} wrap="truncate-middle">${header}</${Text}>
      </${Box}>
      <${FileList}
        entries=${pane.entries}
        cursor=${pane.cursor}
        height=${height}
        width=${inner}
        active=${active}
      />
      <${Box} width=${inner} marginTop=${1}>
        <${Text} dimColor wrap="truncate-end">${footer}</${Text}>
      </${Box}>
    </${Box}>
  `;
}
