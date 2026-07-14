import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { render, Box, Text } from 'ink';
import { CenteredOverlay } from '../src/ui/CenteredOverlay.ts';
import { HelpDialog } from '../src/ui/HelpDialog.ts';
import { html } from '../src/ui/html.ts';

// Minimal stdout stand-in that captures every frame Ink writes.
class FakeStdout extends EventEmitter {
  constructor(cols, rows) {
    super();
    this.columns = cols;
    this.rows = rows;
    this.frames = [];
  }
  write(d) {
    this.frames.push(d);
  }
}

// Minimal stdin stand-in so components using Ink's useInput can mount.
class FakeStdin extends EventEmitter {
  isTTY = true;
  setRawMode() {}
  ref() {}
  unref() {}
  read() {}
  setEncoding() {}
  resume() {}
  pause() {}
}

const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');

// Between the two vertical borders of every bordered row, no backdrop sentinel
// may show — the interior must be fully painted.
function assertNoBleed(lines) {
  const boxRows = lines.filter((l) => (l.match(/│/g) ?? []).length >= 2);
  assert.ok(boxRows.length >= 2, 'bordered interior rows found');
  for (const row of boxRows) {
    const interior = row.slice(row.indexOf('│') + 1, row.lastIndexOf('│'));
    assert.ok(!interior.includes('#'), `backdrop bled into interior: ${JSON.stringify(row)}`);
  }
}

// Backdrop packed with a sentinel char behind the centered help overlay; if the
// dialog left any interior cell unpainted, the sentinel would bleed through.
function HelpScene({ cols, rows, items }) {
  const backdrop = Array.from(
    { length: rows },
    (_, i) => html`<${Text} key=${i}>${'#'.repeat(cols)}</${Text}>`,
  );
  return html`
    <${Box} flexDirection="column">
      <${Box} flexDirection="column">${backdrop}</${Box}>
      <${CenteredOverlay} width=${cols} height=${rows}>
        <${HelpDialog} width=${cols} items=${items} onClose=${() => {}} />
      </${CenteredOverlay}>
    </${Box}>
  `;
}

async function renderHelp(cols, rows, items) {
  const stdout = new FakeStdout(cols, rows);
  const stdin = new FakeStdin();
  const { unmount } = render(html`<${HelpScene} cols=${cols} rows=${rows} items=${items} />`, {
    stdout,
    stdin,
    patchConsole: false,
  });
  await delay(20);
  const frame = stripAnsi(stdout.frames[stdout.frames.length - 1]);
  unmount();
  return frame;
}

test('HelpDialog: panes do not bleed through the help interior', async () => {
  const frame = await renderHelp(60, 30, []);
  const lines = frame.replace(/\n+$/, '').split('\n');
  assert.ok(frame.includes('Keybindings'), 'help title rendered');
  assertNoBleed(lines);
});

test('HelpDialog: lists built-in bindings', async () => {
  const frame = await renderHelp(60, 30, []);
  for (const label of ['Help', 'Copy', 'Rename', 'Quit']) {
    assert.ok(frame.includes(label), `built-in binding "${label}" present`);
  }
});

test('HelpDialog: shows custom entries with a direct marker', async () => {
  const frame = await renderHelp(60, 30, [
    { key: 'g', direct: true, label: 'Git status', command: 'git status' },
  ]);
  assert.ok(frame.includes('Custom (menu.json)'), 'custom section header present');
  assert.ok(frame.includes('Git status'), 'custom entry label present');
  assert.ok(frame.includes('⟨direct⟩'), 'direct marker present');
});

test('HelpDialog: omits the custom section when there are no entries', async () => {
  const frame = await renderHelp(60, 30, []);
  assert.ok(!frame.includes('Custom (menu.json)'), 'custom section omitted');
});
