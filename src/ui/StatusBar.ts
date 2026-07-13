import { Box, Text } from 'ink';
import { html } from './html.ts';

// Norton-Commander-style function-key hints.
const HINTS: [string, string][] = [
  ['2', 'Menu'],
  ['3', 'View'],
  ['4', 'Edit'],
  ['5', 'Copy'],
  ['6', 'Move'],
  ['7', 'MkDir'],
  ['8', 'Del'],
  ['10', 'Quit'],
];

type Props = {
  status?: string;
};

export function StatusBar({ status }: Props) {
  const hints = HINTS.map(([n, label], i) =>
    html`
      <${Text} key=${i}>
        <${Text} color="black" backgroundColor="cyan">F${n}</${Text}>
        <${Text}> ${label}  </${Text}>
      </${Text}>
    `,
  );

  return html`
    <${Box} flexDirection="column">
      <${Box}>${hints}</${Box}>
      <${Box}>
        <${Text} color=${status ? 'yellow' : 'gray'}>${status || ' '}</${Text}>
      </${Box}>
    </${Box}>
  `;
}
