import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { render, Box, Text } from 'ink';
import { CenteredOverlay } from '../src/ui/CenteredOverlay.ts';
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

const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');

// Two-pane stub with a bordered child overlaid centered on top.
function Scene({ cols, rows }) {
  return html`
    <${Box} flexDirection="column">
      <${Box}>
        <${Box} flexDirection="column" width=${Math.floor(cols / 2)} height=${rows} borderStyle="round">
          <${Text}>file1</${Text}>
          <${Text}>file2</${Text}>
          <${Text}>file3</${Text}>
        </${Box}>
        <${Box} flexDirection="column" width=${Math.floor(cols / 2)} height=${rows} borderStyle="round">
          <${Text}>fileA</${Text}>
          <${Text}>fileB</${Text}>
          <${Text}>fileC</${Text}>
        </${Box}>
      </${Box}>
      <${CenteredOverlay} width=${cols} height=${rows}>
        <${Box} flexDirection="column" borderStyle="round" paddingX=${1}>
          <${Text}>User menu</${Text}>
        </${Box}>
      </${CenteredOverlay}>
    </${Box}>
  `;
}

test('CenteredOverlay: floats a centered box over still-visible panes', async () => {
  const stdout = new FakeStdout(40, 12);
  const { unmount } = render(html`<${Scene} cols=${40} rows=${12} />`, {
    stdout,
    patchConsole: false,
  });
  await delay(20);
  const frame = stripAnsi(stdout.frames[stdout.frames.length - 1]);
  unmount();

  const lines = frame.replace(/\n+$/, '').split('\n');

  // Panes remain visible underneath the overlay.
  assert.ok(frame.includes('file1'), 'left pane content present');
  assert.ok(frame.includes('fileA'), 'right pane content present');

  // The overlay's box content is present and horizontally centered: offset from
  // both the left and right edges of the frame (not flush-left/inline).
  const menuLine = lines.find((l) => l.includes('User menu'));
  assert.ok(menuLine, 'overlay content rendered');
  const col = menuLine.indexOf('User menu');
  const cols = 40;
  assert.ok(col > cols * 0.2, `overlay is offset from the left edge (col=${col})`);
  assert.ok(
    col + 'User menu'.length < cols * 0.8,
    `overlay is offset from the right edge (col=${col})`,
  );

  // Vertically centered: the box content row is neither the first nor the last row.
  const boxRow = lines.findIndex((l) => l.includes('User menu'));
  assert.ok(boxRow > 0, 'overlay is offset from the top edge');
  assert.ok(boxRow < lines.length - 1, 'overlay is offset from the bottom edge');
});
