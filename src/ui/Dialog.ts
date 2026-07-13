import { Box, Text } from 'ink';
import type { Modal } from '../types.ts';
import { html } from './html.ts';

// Renders the active modal overlay. Input routing for the dialog lives in
// App.ts (it owns useInput); this component is presentational.
type Props = {
  modal: Modal;
};

export function Dialog({ modal }: Props) {
  if (modal.type === 'confirm') {
    return html`
      <${Box}
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX=${1}
      >
        <${Text} color="yellow" bold>Confirm</${Text}>
        <${Text}>${modal.message}</${Text}>
        <${Text} dimColor>Enter / y = yes    Esc / n = no</${Text}>
      </${Box}>
    `;
  }

  if (modal.type === 'input') {
    return html`
      <${Box}
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX=${1}
      >
        <${Text} color="cyan" bold>${modal.label}</${Text}>
        <${Box}>
          <${Text}>❯ </${Text}>
          <${Text}>${modal.value}</${Text}>
          <${Text} inverse> </${Text}>
        </${Box}>
        <${Text} dimColor>Enter = submit    Esc = cancel</${Text}>
      </${Box}>
    `;
  }

  return null;
}
